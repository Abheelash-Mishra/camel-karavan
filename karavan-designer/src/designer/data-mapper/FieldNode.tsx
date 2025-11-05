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
import { FieldDefinition, ArrayIterationMode } from './DataMapperTypes';
import { Button, Badge, Tooltip } from '@patternfly/react-core';
import { ToggleGroup, ToggleGroupItem } from '@patternfly/react-core';
import { TrashIcon } from '@patternfly/react-icons';

export interface FieldNodeData {
    field: FieldDefinition;
    side: 'source' | 'target';
    onArrayModeChange?: (fieldId: string, mode: ArrayIterationMode) => void;
    onDelete?: () => void;
}

export function FieldNode({ data }: NodeProps<FieldNodeData>) {
    const { field, side, onArrayModeChange, onDelete } = data;
    const [showArrayControl, setShowArrayControl] = React.useState(false);

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

    const handleArrayModeChange = (mode: ArrayIterationMode) => {
        if (onArrayModeChange) {
            onArrayModeChange(field.id, mode);
        }
    };

    const indent = (field.path.match(/\./g) || []).length;
    const isSourceNode = side === 'source';

    return (
        <div 
            className={`field-node ${side}-field`}
            style={{ 
                paddingLeft: `${indent * 12}px`,
                minWidth: '200px'
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
                    </div>
                </div>

                {field.description && (
                    <div className="field-description">{field.description}</div>
                )}

                {field.isArray && side === 'source' && (
                    <div className="array-controls">
                        <Tooltip content="Choose how to iterate over array elements">
                            <Button
                                variant="link"
                                size="sm"
                                onClick={() => setShowArrayControl(!showArrayControl)}
                            >
                                {field.arrayIterationMode === 'for-loop' ? 'Loop' : 
                                 field.arrayIterationMode === 'index-access' ? '[0]' : 'Direct'}
                            </Button>
                        </Tooltip>

                        {showArrayControl && (
                            <div className="array-mode-selector">
                                <ToggleGroup>
                                    <ToggleGroupItem
                                        text="Loop"
                                        isSelected={field.arrayIterationMode === 'for-loop'}
                                        onChange={() => handleArrayModeChange('for-loop')}
                                    />
                                    <ToggleGroupItem
                                        text="[0]"
                                        isSelected={field.arrayIterationMode === 'index-access'}
                                        onChange={() => handleArrayModeChange('index-access')}
                                    />
                                    <ToggleGroupItem
                                        text="Direct"
                                        isSelected={field.arrayIterationMode === 'direct'}
                                        onChange={() => handleArrayModeChange('direct')}
                                    />
                                </ToggleGroup>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
