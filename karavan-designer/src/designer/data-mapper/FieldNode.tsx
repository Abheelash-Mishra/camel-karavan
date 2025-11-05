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
import { FieldDefinition, IndexSelector } from './DataMapperTypes';
import { Button, Badge, Tooltip, MenuToggle, Select, SelectOption, SelectList, TextInput } from '@patternfly/react-core';
import { TrashIcon, CogIcon, CaretDownIcon, CaretRightIcon } from '@patternfly/react-icons';

export interface FieldNodeData {
    field: FieldDefinition;
    side: 'source' | 'target';
    onIndexSelectorChange?: (fieldId: string, selector: IndexSelector, customIndex?: number) => void;
    onListMappingOpen?: (fieldId: string) => void;
    onExpandToggle?: (fieldId: string) => void;
    onDelete?: () => void;
}

export function FieldNode({ data }: NodeProps<FieldNodeData>) {
    const { field, side, onIndexSelectorChange, onListMappingOpen, onExpandToggle, onDelete } = data;
    const [showIndexSelector, setShowIndexSelector] = React.useState(true); // Always show for arrays
    const [showCustomIndex, setShowCustomIndex] = React.useState(false);
    const [customIndexValue, setCustomIndexValue] = React.useState(field.customIndex || 0);
    const [isIndexSelectorOpen, setIsIndexSelectorOpen] = React.useState(false);

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

    const handleIndexSelectorChange = (selector: IndexSelector) => {
        if (onIndexSelectorChange) {
            if (selector === 'custom') {
                setShowCustomIndex(true);
                onIndexSelectorChange(field.id, selector, customIndexValue);
            } else {
                setShowCustomIndex(false);
                onIndexSelectorChange(field.id, selector);
            }
        }
    };

    const handleCustomIndexChange = (value: string) => {
        const numValue = parseInt(value, 10);
        if (!isNaN(numValue) && numValue >= 0) {
            setCustomIndexValue(numValue);
            if (onIndexSelectorChange) {
                onIndexSelectorChange(field.id, 'custom', numValue);
            }
        }
    };

    const getIndexSelectorLabel = (selector?: IndexSelector) => {
        switch (selector) {
            case 'first': return 'First';
            case 'second': return 'Second';
            case 'third': return 'Third';
            case 'last': return 'Last';
            case 'custom': return `[${customIndexValue}]`;
            default: return 'First'; // Default to First Value
        }
    };

    const indent = (field.path.match(/\./g) || []).length;
    const isSourceNode = side === 'source';
    const fieldDepth = indent;
    const isChildField = fieldDepth > 0;

    // Initialize index selector visibility for arrays
    React.useEffect(() => {
        setShowIndexSelector(field.isArray && side === 'source');
        setShowCustomIndex(field.indexSelector === 'custom');
    }, [field.isArray, field.indexSelector, side]);

    return (
        <div 
            className={`field-node ${side}-field ${isChildField ? 'child-field' : ''}`}
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
                        {((field.type === 'object' && !field.isArray) || field.isArray) && field.children && field.children.length > 0 && onExpandToggle && (
                            <Tooltip content={field.isExpanded ? "Collapse fields" : "Expand fields"}>
                                <Button
                                    variant="plain"
                                    icon={field.isExpanded ? <CaretDownIcon /> : <CaretRightIcon />}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onExpandToggle(field.id);
                                    }}
                                    size="sm"
                                    style={{ padding: '2px', minWidth: 'auto', marginLeft: '4px' }}
                                />
                            </Tooltip>
                        )}
                        {field.isArray && side === 'source' && onListMappingOpen && (
                            <Tooltip content="Configure list mapping">
                                <Button
                                    variant="plain"
                                    icon={<CogIcon />}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onListMappingOpen(field.id);
                                    }}
                                    size="sm"
                                    style={{ padding: '2px', minWidth: 'auto', marginLeft: '4px' }}
                                />
                            </Tooltip>
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Tooltip content="Array element selector">
                                <span style={{ fontSize: '12px', color: '#666' }}>
                                    [{getIndexSelectorLabel(field.indexSelector)}]
                                </span>
                            </Tooltip>

                            {showIndexSelector && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Select
                                        isOpen={isIndexSelectorOpen}
                                        selected={field.indexSelector || 'first'}
                                        onSelect={(_, selection) => {
                                            handleIndexSelectorChange(selection as IndexSelector);
                                            setIsIndexSelectorOpen(false);
                                        }}
                                        onOpenChange={setIsIndexSelectorOpen}
                                        toggle={(toggleRef) => (
                                            <MenuToggle
                                                ref={toggleRef}
                                                onClick={() => setIsIndexSelectorOpen(!isIndexSelectorOpen)}
                                                isExpanded={isIndexSelectorOpen}
                                                style={{ width: '80px' }}
                                            >
                                                {getIndexSelectorLabel(field.indexSelector)}
                                                <CaretDownIcon />
                                            </MenuToggle>
                                        )}
                                    >
                                        <SelectList>
                                            <SelectOption value="first">First</SelectOption>
                                            <SelectOption value="second">Second</SelectOption>
                                            <SelectOption value="third">Third</SelectOption>
                                            <SelectOption value="last">Last</SelectOption>
                                            <SelectOption value="custom">Custom</SelectOption>
                                        </SelectList>
                                    </Select>
                                    {showCustomIndex && (
                                        <TextInput
                                            type="number"
                                            value={customIndexValue.toString()}
                                            onChange={(_, value) => handleCustomIndexChange(value)}
                                            style={{ width: '50px' }}
                                            min={0}
                                        />
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
