/*
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React from 'react';
import {
    Modal,
    ModalVariant,
    Button,
    Title,
    Toolbar,
    ToolbarContent,
    ToolbarItem
} from '@patternfly/react-core';
import ReactFlow, {
    Node,
    Edge,
    useNodesState,
    useEdgesState,
    addEdge,
    Connection,
    ReactFlowProvider,
    Controls,
    Background,
    BackgroundVariant,
    Panel,
    ConnectionLineType
} from 'reactflow';
import 'reactflow/dist/style.css';
import { FieldDefinition, FieldMapping, ListMappingConfig } from './DataMapperTypes';
import { FieldNode, FieldNodeData } from './FieldNode';
import { MappingEdge } from './MappingEdge';

export interface ListMappingModalProps {
    isOpen: boolean;
    onClose: () => void;
    sourceField?: FieldDefinition;
    targetField?: FieldDefinition;
    listMappingConfig?: ListMappingConfig;
    onSave: (config: ListMappingConfig) => void;
}

const nodeTypes = {
    fieldNode: FieldNode,
};

const edgeTypes = {
    mappingEdge: MappingEdge,
};

export function ListMappingModal({
    isOpen,
    onClose,
    sourceField,
    targetField,
    listMappingConfig,
    onSave
}: ListMappingModalProps) {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [fieldMappings, setFieldMappings] = React.useState<FieldMapping[]>(
        listMappingConfig?.fieldMappings || []
    );

    // Extract array item fields for mapping (assuming arrays contain objects)
    const getArrayItemFields = (field: FieldDefinition): FieldDefinition[] => {
        if (!field?.isArray || !field.children) {
            return [];
        }
        
        // For array fields, we want to map the structure of individual items
        // So we take the children of the array field (which represent the item structure)
        return field.children;
    };

    const createNodesFromFields = React.useCallback((
        fields: FieldDefinition[], 
        side: 'source' | 'target', 
        startY: number = 0
    ): Node<FieldNodeData>[] => {
        if (!fields || fields.length === 0) {
            return [];
        }
        
        return fields.map((field, index) => ({
            id: `${side}-${field.id}`,
            type: 'fieldNode',
            position: { 
                x: side === 'source' ? 50 : 650, 
                y: startY + (index * 60) 
            },
            data: {
                field,
                side,
                onArrayModeChange: undefined, // Not needed in list mapping context
                onIndexSelectorChange: undefined,
                onListMappingOpen: undefined,
                onDelete: undefined
            }
        }));
    }, []);

    const createEdgesFromMappings = React.useCallback((mappings: FieldMapping[]): Edge[] => {
        return mappings.map(mapping => ({
            id: mapping.id,
            source: `source-${mapping.sourceFieldIds[0]}`,
            target: `target-${mapping.targetFieldId}`,
            sourceHandle: `${mapping.sourceFieldIds[0]}-source`,
            targetHandle: `${mapping.targetFieldId}-target`,
            type: 'mappingEdge',
            data: {
                mapping,
                onDelete: () => handleDeleteMapping(mapping.id)
            }
        }));
    }, []);

    // Initialize nodes and edges when modal opens
    React.useEffect(() => {
        if (isOpen && sourceField && targetField) {
            const sourceItemFields = getArrayItemFields(sourceField);
            const targetItemFields = getArrayItemFields(targetField);
            
            const sourceNodes = createNodesFromFields(sourceItemFields, 'source');
            const targetNodes = createNodesFromFields(targetItemFields, 'target');
            
            setNodes([...sourceNodes, ...targetNodes]);
            setEdges(createEdgesFromMappings(fieldMappings));
        }
    }, [isOpen, sourceField, targetField, fieldMappings, createNodesFromFields, createEdgesFromMappings]);

    const handleConnection = React.useCallback((connection: Connection) => {
        if (!connection.source || !connection.target) return;
        
        // Extract field IDs from node IDs
        const sourceFieldId = connection.source.replace('source-', '');
        const targetFieldId = connection.target.replace('target-', '');
        
        const newMapping: FieldMapping = {
            id: `mapping-${Date.now()}`,
            sourceFieldIds: [sourceFieldId],
            targetFieldId,
        };
        
        setFieldMappings(prev => [...prev, newMapping]);
        
        const newEdge = {
            id: newMapping.id,
            source: connection.source,
            target: connection.target,
            sourceHandle: connection.sourceHandle,
            targetHandle: connection.targetHandle,
            type: 'mappingEdge',
            data: {
                mapping: newMapping,
                onDelete: () => handleDeleteMapping(newMapping.id)
            }
        };
        
        setEdges(eds => addEdge(newEdge, eds));
    }, []);

    const handleDeleteMapping = React.useCallback((mappingId: string) => {
        setFieldMappings(prev => prev.filter(m => m.id !== mappingId));
        setEdges(eds => eds.filter(edge => edge.id !== mappingId));
    }, []);

    const handleSave = () => {
        if (!sourceField?.path || !targetField?.path) {
            console.error('Source or target field is missing');
            return;
        }
        
        const config: ListMappingConfig = {
            id: listMappingConfig?.id || `list-mapping-${Date.now()}`,
            sourceArrayPath: sourceField.path,
            targetArrayPath: targetField.path,
            fieldMappings,
            nestedLevel: 1 // Can be enhanced to support deeper nesting
        };
        
        onSave(config);
        onClose();
    };

    const handleFitView = () => {
        // This will be handled by ReactFlow's fitView function
    };

    // Don't render modal if required fields are missing
    if (!sourceField || !targetField) {
        return null;
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            variant={ModalVariant.large}
            title="List Mapping Configuration"
            width="90vw"
            height="80vh"
            actions={[
                <Button key="save" variant="primary" onClick={handleSave}>
                    Save
                </Button>,
                <Button key="cancel" variant="link" onClick={onClose}>
                    Cancel
                </Button>
            ]}
        >
            <div style={{ height: '70vh', width: '100%' }}>
                <Toolbar>
                    <ToolbarContent>
                        <ToolbarItem>
                            <Title headingLevel="h4" size="md">
                                Map fields from {sourceField?.name || 'Source'}[] to {targetField?.name || 'Target'}[]
                            </Title>
                        </ToolbarItem>
                        <ToolbarItem align={{ default: 'alignRight' }}>
                            <Button variant="secondary" onClick={handleFitView}>
                                Fit View
                            </Button>
                        </ToolbarItem>
                    </ToolbarContent>
                </Toolbar>
                
                <ReactFlowProvider>
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={handleConnection}
                        nodeTypes={nodeTypes}
                        edgeTypes={edgeTypes}
                        connectionLineType={ConnectionLineType.SmoothStep}
                        fitView
                        attributionPosition="bottom-left"
                    >
                        <Background variant={BackgroundVariant.Dots} />
                        <Controls />
                        <Panel position="top-left">
                            <div style={{ background: 'white', padding: '10px', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                                <strong>Source Array Items</strong>
                                <div style={{ color: '#666', fontSize: '12px' }}>
                                    Connect fields from source array items to target array items
                                </div>
                            </div>
                        </Panel>
                        <Panel position="top-right">
                            <div style={{ background: 'white', padding: '10px', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                                <strong>Target Array Items</strong>
                                <div style={{ color: '#666', fontSize: '12px' }}>
                                    Each source item will be transformed to this structure
                                </div>
                            </div>
                        </Panel>
                    </ReactFlow>
                </ReactFlowProvider>
            </div>
        </Modal>
    );
}