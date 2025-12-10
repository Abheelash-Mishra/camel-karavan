import React, { useState, useEffect } from 'react';
import { Handle, Position } from 'reactflow';
import { FieldDefinition } from './DataMapperTypes';
import { Button, Badge } from '@patternfly/react-core';

export interface SchemaRootNodeData {
    fields: FieldDefinition[];
    side: 'source' | 'target';
}

function isPrimitive(type: string) {
    return ['string', 'number', 'boolean', 'null'].includes(type);
}

export function SchemaRootNode({ data }: { data: SchemaRootNodeData }) {
    const { fields, side } = data;
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    // no explicit measurement: center handles within their row using CSS

    // Build a map of fields by parent for quick tree render
    const parentMap = new Map<string | undefined, FieldDefinition[]>();
    fields.forEach(f => {
        const list = parentMap.get(f.parent) || [];
        list.push(f);
        parentMap.set(f.parent, list);
    });

    // Compute a stable order for primitive fields so we can space handles vertically
    const primitiveOrder: string[] = [];
    const buildPrimitiveOrder = (parentId?: string) => {
        const children = parentMap.get(parentId) || [];
        children.forEach(child => {
            if (isPrimitive(child.type)) {
                primitiveOrder.push(child.id);
            }
            // Visit non-primitives to collect deeper primitives in visual order
            if (!isPrimitive(child.type)) {
                buildPrimitiveOrder(child.id);
            }
        });
    };
    buildPrimitiveOrder(undefined);

    const primitiveIndex = new Map<string, number>();
    primitiveOrder.forEach((id, idx) => primitiveIndex.set(id, idx));

    // Initialize expanded state from incoming fields (use field.isExpanded when present)
    React.useEffect(() => {
        const map: Record<string, boolean> = {};
        fields.forEach(f => {
            if (!isPrimitive(f.type)) {
                map[f.id] = f.isExpanded === true;
            }
        });
        setExpanded(prev => ({ ...map, ...prev }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fields]);

    const toggle = (id: string) => {
        setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const INDENT = 6; // pixels per depth level (reduced)


    const renderChildren = (parentId?: string, depth = 0) => {
        const children = parentMap.get(parentId) || [];
        return children.map(field => (
            <div key={field.id} style={{ display: 'block' }}>
                <div style={{ paddingLeft: depth * INDENT, display: 'flex', alignItems: 'center', position: 'relative', paddingTop: 6, paddingBottom: 6, borderRadius: 4, background: depth % 2 === 0 ? 'rgba(0,0,0,0.02)' : 'transparent' }}>
                    {/* Render handle for primitives and for arrays of primitives only. */}
                    {(() => {
                        if (isPrimitive(field.type)) {
                            return (
                                <Handle
                                    type={side === 'source' ? 'source' : 'target'}
                                    position={side === 'source' ? Position.Right : Position.Left}
                                    id={field.path}
                                    style={{
                                        background: '#555',
                                        width: 10,
                                        height: 10,
                                        top: '50%',
                                        transform: `translateX(${side === 'source' ? '3px' : '0px'}) translateY(-50%)`,
                                        marginRight: 0,
                                    }}
                                />
                            );
                        }

                        if (field.isArray) {
                            const arrayChildren = parentMap.get(field.id) || [];
                            const itemNode = arrayChildren[0];
                            // Only show a handle for arrays when the item node is a primitive (array of primitives)
                            if (!itemNode || isPrimitive(itemNode.type)) {
                                return (
                                    <Handle
                                        type={side === 'source' ? 'source' : 'target'}
                                        position={side === 'source' ? Position.Right : Position.Left}
                                        id={field.path}
                                        style={{
                                            background: '#555',
                                            width: 10,
                                            height: 10,
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            marginRight: 8,
                                        }}
                                    />
                                );
                            }
                        }

                        return null;
                    })()}

                    {/* Allow expand/collapse for objects and arrays of objects */}
                    {(() => {
                        const childrenOfArray = parentMap.get(field.id) || [];
                        const itemNode = field.isArray ? (childrenOfArray[0] || undefined) : undefined;
                        const canExpand = (!isPrimitive(field.type) && !field.isArray) || (field.isArray && itemNode?.type === 'object');
                        if (!canExpand) return null;
                        return (
                            <Button variant="plain" onClick={() => toggle(field.id)} style={{ marginRight: 8 }}>
                                {expanded[field.id] ? '-' : '+'}
                            </Button>
                        );
                    })()}

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ marginLeft: 6 }}>{field.name}</div>
                        {field.isArray && <Badge className="array-badge">[]</Badge>}
                        {field.isArray ? (
                            (() => {
                                const childrenOfArray = parentMap.get(field.id) || [];
                                const itemNode = childrenOfArray[0];
                                const itemType = itemNode?.type || 'unknown';
                                // const displayType = itemType ? itemType.charAt(0).toUpperCase() + itemType.slice(1) : itemType;
                                
                                return <div style={{ color: '#666', fontSize: 11 }}>{itemType}</div>;
                            })()
                        ) : (
                            <div style={{ color: '#666', fontSize: 11 }}>{field.type}</div>
                        )}
                    </div>
                </div>

                {/* Render nested children for objects and arrays-of-objects when expanded. */}
                {(() => {
                    const childrenOfArray = parentMap.get(field.id) || [];
                    const itemNode = field.isArray ? (childrenOfArray[0] || undefined) : undefined;
                    const canRenderChildren = ((!isPrimitive(field.type) && !field.isArray) || (field.isArray && itemNode?.type === 'object')) && expanded[field.id];
                    if (!canRenderChildren) return null;
                    return (
                        <div style={{ marginTop: 4 }}>
                            {field.isArray ? (
                                itemNode ? renderChildren(itemNode.id, depth + 1) : null
                            ) : (
                                renderChildren(field.id, depth + 1)
                            )}
                        </div>
                    );
                })()}
            </div>
        ));
    };

    // No DOM measurement — handles are centered inside each row using CSS

    return (
        <div style={{ padding: 8, minWidth: 280, maxWidth: 380, background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 6, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>{data.side === 'source' ? 'Source' : 'Target'}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {renderChildren(undefined, 0)}
            </div>
        </div>
    );
}

export default SchemaRootNode;
