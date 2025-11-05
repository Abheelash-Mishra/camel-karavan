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
import { Handle, Position, NodeProps } from 'reactflow';
import { FieldDefinition } from './DataMapperTypes';
import { Button, Badge, Tooltip } from '@patternfly/react-core';
import { TrashIcon } from '@patternfly/react-icons';

export interface FieldNodeData {
    field: FieldDefinition;
    side: 'source' | 'target';
    onDelete?: () => void;
}

export function FieldNode({ data }: NodeProps<FieldNodeData>) {
    const { field, side, onDelete } = data;

    const getTypeColor = (type: string): string => {
        switch (type) {
            case 'string': return 'blue';
            case 'number': return 'green';
            case 'boolean': return 'purple';
            case 'object': return 'orange';
            case 'array': return 'cyan';
            default: return 'grey';
        }
    };

    const getFieldBackgroundClass = (type: string, isArray: boolean): string => {
        if (isArray) return 'field-array';
        if (type === 'object') return 'field-object';
        return 'field-primitive';
    };

    const indent = (field.path.match(/\./g) || []).length;
    const isSourceNode = side === 'source';
    const fieldDepth = field.depth || indent;
    const isChildField = fieldDepth > 0;
    const depthWarning = fieldDepth > 5 ? ' field-depth-warning' : '';
    const depthClass = fieldDepth > 0 ? ` field-depth-${Math.min(fieldDepth, 5)}` : '';
    const backgroundClass = getFieldBackgroundClass(field.type, field.isArray);

    return (
        <div 
            className={`field-node ${side}-field ${backgroundClass}${depthClass}${depthWarning} ${isChildField ? 'child-field' : ''}`}
            data-depth={fieldDepth}
            style={{ 
                minWidth: '200px',
                position: 'relative'
            }}
        >
            {isSourceNode && (
                <Handle
                    type="source"
                    position={Position.Right}
                    id={`${field.id}-source`}
                    style={{ right: -8, background: '#555' }}
                />
            )}
            {!isSourceNode && (
                <Handle
                    type="target"
                    position={Position.Left}
                    id={`${field.id}-target`}
                    style={{ left: -8, background: '#555' }}
                />
            )}

            <div className="field-content">
                <div className="field-header">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        <span className="field-name">{field.name}</span>
                        {onDelete && (
                            <Button
                                variant="plain"
                                icon={<TrashIcon />}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete();
                                }}
                                size="sm"
                                style={{ padding: 0, minWidth: 'auto' }}
                            />
                        )}
                    </div>
                    <div className="field-badges">
                        {field.isArray && (
                            <Badge className="array-badge">[]</Badge>
                        )}
                        <Badge style={{ backgroundColor: `var(--pf-v5-global--palette--${getTypeColor(field.type)}-200)` }}>
                            {field.type}
                        </Badge>
                        {fieldDepth > 5 && (
                            <Badge style={{ backgroundColor: 'var(--pf-v5-global--palette--red-200)', color: '#721c24' }}>
                                Deep: {fieldDepth}
                            </Badge>
                        )}
                    </div>
                </div>

                {field.description && (
                    <div className="field-description">{field.description}</div>
                )}
            </div>
        </div>
    );
}
