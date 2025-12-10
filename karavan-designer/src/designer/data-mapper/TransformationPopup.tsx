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

import React, { useState } from 'react';
import {
    Modal,
    ModalVariant,
    Button,
    Form,
    FormGroup,
    FormSelect,
    FormSelectOption,
    TextArea,
    TextInput,
    Card,
    CardBody,
    CardTitle,
    Divider,
    Text,
    TextVariants,
    Grid,
    GridItem,
    HelperText,
    HelperTextItem,
} from '@patternfly/react-core';
import { ArrowRightIcon } from '@patternfly/react-icons';
import { JSLT_FUNCTIONS, TransformationFunction, FieldMapping, FieldDefinition, IndexSelector } from './DataMapperTypes';

interface TransformationPopupProps {
    isOpen: boolean;
    currentMapping?: FieldMapping;
    sourceFields?: FieldDefinition[];
    targetFields?: FieldDefinition[];
    onClose: () => void;
    // onApply now accepts a partial FieldMapping update so callers can set transformation and/or index selection
    onApply: (updates: Partial<FieldMapping>) => void;
    onEditMultiSource?: () => void;
}

export function TransformationPopup({ 
    isOpen, 
    currentMapping, 
    sourceFields = [],
    targetFields = [],
    onClose, 
    onApply,
    onEditMultiSource
}: TransformationPopupProps) {
    const [selectedFunction, setSelectedFunction] = useState(currentMapping?.transformation?.name || '');
    const [parameters, setParameters] = useState<string[]>(
        currentMapping?.transformation?.parameters || []
    );

    // Index selection state for array->non-array mappings
    const [indexSelector, setIndexSelector] = useState<IndexSelector | undefined>(currentMapping?.indexSelector);
    const [indexValue, setIndexValue] = useState<number | undefined>(currentMapping?.indexValue);
    const [indexEnabled, setIndexEnabled] = useState<boolean>(currentMapping?.indexSelector !== undefined);

    React.useEffect(() => {
        setSelectedFunction(currentMapping?.transformation?.name || '');
        setParameters(currentMapping?.transformation?.parameters || []);
        setIndexSelector(currentMapping?.indexSelector);
        setIndexValue(currentMapping?.indexValue);
        setIndexEnabled(currentMapping?.indexSelector !== undefined);
    }, [currentMapping, isOpen]);

    const handleApply = () => {
        const updates: Partial<FieldMapping> = {};
        if (!selectedFunction) {
            updates.transformation = undefined;
        } else {
            updates.transformation = {
                name: selectedFunction,
                parameters: parameters && parameters.length > 0 ? parameters.map(p => p?.toString()) : undefined,
            };
        }
        // Include index selection if set (may be undefined)
        if (indexSelector) {
            updates.indexSelector = indexSelector;
            if (indexSelector === 'custom' && typeof indexValue === 'number') {
                updates.indexValue = indexValue;
            } else {
                updates.indexValue = undefined;
            }
        } else {
            updates.indexSelector = undefined;
            updates.indexValue = undefined;
        }

        onApply(updates);
        onClose();
    };

    // Persist index changes immediately so generator and UI reflect index updates without needing Apply
    React.useEffect(() => {
        if (!isOpen || !currentMapping) return;
        // Only send index-related updates (do not override transformation here)
        const updates: Partial<FieldMapping> = {};
        if (indexEnabled) {
            updates.indexSelector = indexSelector;
            updates.indexValue = indexSelector === 'custom' ? indexValue : undefined;
        } else {
            updates.indexSelector = undefined;
            updates.indexValue = undefined;
        }
        onApply(updates);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [indexEnabled, indexSelector, indexValue]);

    const handleRemove = () => {
        // Clearing transformation and index selection
        onApply({ transformation: undefined, indexSelector: undefined, indexValue: undefined });
        onClose();
    };

    const selectedFunctionDef = JSLT_FUNCTIONS.find(f => f.name === selectedFunction);
    
    // Get source and target field details
    const sourceFieldDetails = currentMapping?.sourceFieldIds.map(id => 
        sourceFields.find(f => f.id === id)
    ).filter(Boolean) || [];
    
    const targetField = targetFields.find(f => f.id === currentMapping?.targetFieldId);

    // Helper: find nearest array ancestor for a source field by walking parents
    const findNearestArrayAncestor = (field: FieldDefinition | undefined) => {
        if (!field || !sourceFields) return undefined;
        let node: FieldDefinition | undefined = field;
        while (node && node.parent) {
            const parent = sourceFields.find(f => f.id === node!.parent);
            if (!parent) break;
            if (parent.type === 'array' || parent.isArray) return parent;
            node = parent;
        }
        return undefined;
    };

    // Detect array-specific context (consider nearest array ancestor for source fields)
    const sourceHasArrayContext = sourceFieldDetails.some(f => {
        if (!f) return false;
        if (f.type === 'array' || f.isArray) return true;
        return !!findNearestArrayAncestor(f);
    });
    const targetIsArray = !!(targetField && (targetField.type === 'array' || targetField.isArray));
    const involvesArray = targetIsArray || sourceHasArrayContext;
    const isArrayToArray = targetIsArray && sourceHasArrayContext;
    const [enableForLoop, setEnableForLoop] = useState<boolean>(isArrayToArray);

    // Show index selector when the single source field is under an array (either itself or an ancestor),
    // and the target is not an array (we pick an item).
    const showIndexSelector = !!(
        sourceFieldDetails.length === 1 &&
        ( (sourceFieldDetails[0] && (sourceFieldDetails[0].type === 'array' || sourceFieldDetails[0].isArray)) ||
          !!findNearestArrayAncestor(sourceFieldDetails[0]) ) &&
        !(targetField && (targetField.type === 'array' || targetField.isArray))
    );

    return (
        <Modal
            variant={ModalVariant.medium}
            title="Mapping Details"
            isOpen={isOpen}
            onClose={onClose}
            actions={[
                <Button key="apply" variant="primary" onClick={handleApply}>
                    Apply
                </Button>,
                currentMapping?.transformation && (
                    <Button key="remove" variant="danger" onClick={handleRemove}>
                        Remove Transformation
                    </Button>
                ),
                <Button key="cancel" variant="link" onClick={onClose}>
                    Cancel
                </Button>,
            ].filter(Boolean)}
        >
            {/* Mapping Overview */}
            <Card isCompact className="mapping-overview-card">
                <CardTitle>
                    <Text component={TextVariants.h3}>Field Mapping</Text>
                </CardTitle>
                <CardBody>
                    <Grid hasGutter>
                        <GridItem span={5}>
                            <div className="mapping-field-info">
                                <Text component={TextVariants.small} className="field-label">Source Field{sourceFieldDetails.length > 1 ? 's' : ''}</Text>
                                {sourceFieldDetails.map((field, idx) => (
                                    <div key={idx} className="field-detail">
                                        <Text component={TextVariants.p}>
                                            <strong>{field?.name}</strong>
                                            <span className="field-type-badge">{field?.type}</span>
                                        </Text>
                                        <Text component={TextVariants.small} className="field-path">{field?.path}</Text>
                                    </div>
                                ))}
                            </div>
                        </GridItem>
                        <GridItem span={2} className="mapping-arrow-container">
                            <ArrowRightIcon />
                        </GridItem>
                        <GridItem span={5}>
                            <div className="mapping-field-info">
                                <Text component={TextVariants.small} className="field-label">Target Field</Text>
                                <div className="field-detail">
                                    <Text component={TextVariants.p}>
                                        <strong>{targetField?.name}</strong>
                                        <span className="field-type-badge">{targetField?.type}</span>
                                    </Text>
                                    <Text component={TextVariants.small} className="field-path">{targetField?.path}</Text>
                                </div>
                            </div>
                        </GridItem>
                    </Grid>
                </CardBody>
            </Card>

            <Divider style={{ margin: '12px 0' }} />

            {/* Multi-Source Expression */}
            {currentMapping && currentMapping.sourceFieldIds.length > 1 && (
                <>
                    <Form>
                        <Text component={TextVariants.h4} style={{ marginBottom: '8px' }}>
                            Multi-Source Expression
                        </Text>
                        <HelperText>
                            <HelperTextItem>
                                Combine multiple source fields using an expression
                            </HelperTextItem>
                        </HelperText>

                        <FormGroup 
                            label="Expression" 
                            fieldId="multi-source-expression"
                            style={{ marginTop: '8px' }}
                        >
                            <TextArea
                                id="multi-source-expression"
                                value={currentMapping.multiSourceExpression || 'No expression defined'}
                                readOnly
                                rows={2}
                            />
                            <HelperText>
                                <HelperTextItem>
                                    <Button 
                                        variant="link" 
                                        isInline 
                                        onClick={() => {
                                            if (onEditMultiSource) {
                                                onClose();
                                                onEditMultiSource();
                                            }
                                        }}
                                    >
                                        Edit Expression
                                    </Button>
                                </HelperTextItem>
                            </HelperText>
                        </FormGroup>
                    </Form>
                    <Divider style={{ margin: '12px 0' }} />
                </>
            )}

            {/* Array Mapping Configuration */}
            {involvesArray && (
                <Form style={{ marginBottom: '12px' }}>
                    <Text component={TextVariants.h4} style={{ marginBottom: '8px' }}>
                        Array Mapping
                    </Text>
                    <HelperText>
                        <HelperTextItem>
                            {isArrayToArray
                                ? 'Map array items using a for-loop or index access.'
                                : 'Apply array-specific operations (index access) to source or target.'}
                        </HelperTextItem>
                    </HelperText>
                    <FormGroup label="Use for-loop" fieldId="array-for-loop" style={{ marginTop: 8 }}>
                        <Button
                            variant={enableForLoop ? 'primary' : 'secondary'}
                            isDisabled={indexEnabled}
                            onClick={() => {
                                const next = !enableForLoop;
                                setEnableForLoop(next);
                                if (next) {
                                    // Enabling for-loop disables indexing
                                    if (indexEnabled) {
                                        setIndexEnabled(false);
                                    }
                                    setIndexSelector(undefined);
                                    setIndexValue(undefined);
                                    // Persist removal of index selection immediately
                                    onApply({ indexSelector: undefined, indexValue: undefined });
                                }
                            }}
                        >
                            {enableForLoop ? 'Enabled' : 'Disabled'}
                        </Button>
                        <HelperText>
                            <HelperTextItem>
                                When enabled, the generated JSLT will use [for (...)] on the source array and map item fields.
                            </HelperTextItem>
                            <HelperTextItem variant="warning">
                                Indexing and for-loop are mutually exclusive. Disable indexing to use for-loop.
                            </HelperTextItem>
                        </HelperText>
                    </FormGroup>

                    {showIndexSelector && (
                        <div style={{ marginTop: 8 }}>
                            <FormGroup label="Indexing" fieldId="index-toggle" style={{ marginBottom: 8 }}>
                                <Button variant={indexEnabled ? 'primary' : 'secondary'} onClick={() => {
                                    // Toggle indexing enabled/disabled
                                    if (indexEnabled) {
                                        setIndexEnabled(false);
                                        setIndexSelector(undefined);
                                        setIndexValue(undefined);
                                    } else {
                                        // enable with default 'first' if nothing selected
                                        setIndexEnabled(true);
                                        setIndexSelector(prev => prev || 'first');
                                        // Enabling indexing disables for-loop
                                        if (enableForLoop) {
                                            setEnableForLoop(false);
                                        }
                                    }
                                }}>
                                    {indexEnabled ? 'Indexing Enabled' : 'Indexing Disabled'}
                                </Button>
                                <HelperText>
                                    <HelperTextItem>
                                        When enabled, the mapping will pick a single item from the source array before transformations. Disable to operate on the whole array (for use with functions like join()).
                                    </HelperTextItem>
                                    <HelperTextItem variant="warning">
                                        Indexing and for-loop are mutually exclusive. Disable for-loop to enable indexing.
                                    </HelperTextItem>
                                </HelperText>
                            </FormGroup>

                            {indexEnabled && (
                                <FormGroup label="Index Selection" fieldId="index-selection">
                                    <FormSelect value={indexSelector || ''} onChange={(_e, val) => setIndexSelector(val as IndexSelector || undefined)} id="index-selection">
                                        <FormSelectOption value="" label="No index (use first/mapping or for-loop)" />
                                        <FormSelectOption value="first" label="First (0)" />
                                        <FormSelectOption value="last" label="Last" />
                                        <FormSelectOption value="custom" label="Custom index" />
                                    </FormSelect>
                                    {indexSelector === 'custom' && (
                                        <TextInput
                                            type="number"
                                            value={indexValue !== undefined ? String(indexValue) : ''}
                                            onChange={(value: any, event?: any) => {
                                                let v: string;
                                                if (typeof value === 'string') {
                                                    v = value;
                                                } else if (value && (value.currentTarget || value.target)) {
                                                    const tgt = (value.currentTarget || value.target) as any;
                                                    v = tgt && typeof tgt.value === 'string' ? tgt.value : String(tgt && tgt.value || '');
                                                } else if (event && (event.currentTarget || event.target)) {
                                                    const tgt = (event.currentTarget || event.target) as any;
                                                    v = tgt && typeof tgt.value === 'string' ? tgt.value : String(tgt && tgt.value || '');
                                                } else {
                                                    v = String(value == null ? '' : value);
                                                }
                                                setIndexValue(v === '' ? undefined : Number(v));
                                            }}
                                            id="index-value"
                                            style={{ marginTop: 8, maxWidth: 120 }}
                                        />
                                    )}
                                </FormGroup>
                            )}
                        </div>
                    )}
                </Form>
            )}

            {/* Transformation Configuration */}
            <Form>
                <Text component={TextVariants.h4} style={{ marginBottom: '8px' }}>
                    Transformation Function
                </Text>
                <HelperText>
                    <HelperTextItem>
                        Apply a JSLT function to transform source field values before mapping to target
                    </HelperTextItem>
                </HelperText>

                <FormGroup 
                    label="Function" 
                    fieldId="function-select"
                    style={{ marginTop: '8px' }}
                >
                    <FormSelect
                        value={selectedFunction}
                        onChange={(_event, value) => setSelectedFunction(value)}
                        id="function-select"
                    >
                        <FormSelectOption key="none" value="" label="No transformation" />
                        {JSLT_FUNCTIONS.map(func => (
                            <FormSelectOption 
                                key={func.name} 
                                value={func.name} 
                                label={`${func.name}() - ${func.description}`}
                            />
                        ))}
                    </FormSelect>
                </FormGroup>

                {selectedFunction && selectedFunctionDef && (
                    <>
                        <HelperText style={{ marginTop: '4px' }}>
                            <HelperTextItem variant="indeterminate">
                                <strong>Example:</strong> {selectedFunctionDef.example}
                            </HelperTextItem>
                        </HelperText>
                        {selectedFunctionDef.params && selectedFunctionDef.params.length > 0 ? (
                            <>
                                {selectedFunctionDef.params.map((p, idx) => (
                                    <FormGroup key={p.name} label={p.name} fieldId={`param-${idx}`} style={{ marginTop: 8 }}>
                                        <TextInput
                                            id={`param-${idx}`}
                                            value={(parameters[idx] ?? p.default) || ''}
                                            onChange={(value: any, event?: any) => {
                                                // PatternFly/TextInput onChange may pass either:
                                                // - (value: string, event)
                                                // - (event) where the event is the first arg
                                                let v: string;
                                                if (typeof value === 'string') {
                                                    v = value;
                                                } else if (value && (value.currentTarget || value.target)) {
                                                    // value is an event-like object
                                                    const tgt = (value.currentTarget || value.target) as any;
                                                    v = tgt && typeof tgt.value === 'string' ? tgt.value : String(tgt && tgt.value || '');
                                                } else if (event && (event.currentTarget || event.target)) {
                                                    const tgt = (event.currentTarget || event.target) as any;
                                                    v = tgt && typeof tgt.value === 'string' ? tgt.value : String(tgt && tgt.value || '');
                                                } else {
                                                    v = String(value == null ? '' : value);
                                                }

                                                const next = [...parameters];
                                                next[idx] = v;
                                                setParameters(next);
                                            }}
                                            placeholder={p.placeholder || ''}
                                        />
                                        <HelperText>
                                            <HelperTextItem>
                                                {p.description}
                                            </HelperTextItem>
                                        </HelperText>
                                    </FormGroup>
                                ))}
                            </>
                        ) : (
                            <HelperText style={{ marginTop: '8px' }}>
                                <HelperTextItem>
                                    This function does not require additional parameters.
                                </HelperTextItem>
                            </HelperText>
                        )}
                    </>
                )}
            </Form>
        </Modal>
    );
}
