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
    onDeleteMapping?: () => void;
}

export function TransformationPopup({ 
    isOpen, 
    currentMapping, 
    sourceFields = [],
    targetFields = [],
    onClose, 
    onApply,
    onEditMultiSource,
    onDeleteMapping,
}: TransformationPopupProps) {
    const [selectedFunction, setSelectedFunction] = useState(currentMapping?.transformation?.name || '');
    const [parameters, setParameters] = useState<string[]>(
        currentMapping?.transformation?.parameters || []
    );
    // Local index selection state for contexts where indexing makes sense
    const [localIndexSelector, setLocalIndexSelector] = useState<IndexSelector | undefined>(currentMapping?.indexSelector);
    const [localIndexValue, setLocalIndexValue] = useState<number | undefined>(currentMapping?.indexValue);

    React.useEffect(() => {
        setSelectedFunction(currentMapping?.transformation?.name || '');
        setParameters(currentMapping?.transformation?.parameters || []);
        setLocalIndexSelector(currentMapping?.indexSelector);
        setLocalIndexValue(currentMapping?.indexValue);
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

        // Infer array behavior (indexing vs for-loop) from context and selected transformation
        // - If mapping is child-of-array -> non-array AND an array function is selected: clear index to allow for-loop array comprehension inside function
        // - If mapping is child-of-array -> non-array AND no array function selected: default to first index (0)
        // - Otherwise: clear any index selection
        const arrayFunctionNames = new Set(['sum','min','max','size','flatten','reverse','sort','unique','join']);
        const isArrayFunctionSelected = selectedFunction ? arrayFunctionNames.has(selectedFunction) : false;

        // Determine context
        const sourceFieldDetails = currentMapping?.sourceFieldIds.map(id => 
            sourceFields.find(f => f.id === id)
        ).filter(Boolean) || [];
        const targetField = targetFields.find(f => f.id === currentMapping?.targetFieldId);

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

        const sourceUnderArray = !!(
            sourceFieldDetails.length === 1 && (
                (sourceFieldDetails[0] && (sourceFieldDetails[0].type === 'array' || sourceFieldDetails[0].isArray)) ||
                !!findNearestArrayAncestor(sourceFieldDetails[0])
            )
        );
        const targetIsArray = !!(targetField && (targetField.type === 'array' || targetField.isArray));
        const childOfArrayToNonArray = sourceUnderArray && !targetIsArray;

        if (childOfArrayToNonArray) {
            if (isArrayFunctionSelected) {
                // Clear any index selection to let generator build [for (...)] within the function
                updates.indexSelector = undefined;
                updates.indexValue = undefined;
            } else {
                // Use chosen index from UI, default to first
                updates.indexSelector = (localIndexSelector || 'first') as IndexSelector;
                updates.indexValue = localIndexSelector === 'custom' && typeof localIndexValue === 'number' ? localIndexValue : undefined;
            }
        } else {
            // No indexing applicable in other contexts
            updates.indexSelector = undefined;
            updates.indexValue = undefined;
        }

        onApply(updates);
        onClose();
    };

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
    const childOfArrayToNonArray = !!(
        sourceFieldDetails.length === 1 && (
            (sourceFieldDetails[0] && (sourceFieldDetails[0].type === 'array' || sourceFieldDetails[0].isArray)) ||
            !!findNearestArrayAncestor(sourceFieldDetails[0])
        ) && !targetIsArray
    );
    const arrayFunctionNames = new Set(['sum','min','max','size','flatten','reverse','sort','unique','join']);
    const arrayFuncSupportsIndexOrWhole = new Set(['size','reverse']);
    const isArrayFunctionSelected = selectedFunction ? arrayFunctionNames.has(selectedFunction) : false;

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
                onDeleteMapping && (
                    <Button key="delete-mapping" variant="danger" onClick={() => { onDeleteMapping(); onClose(); }}>
                        Delete Mapping
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

            {/* Index selection is shown when indexing makes sense and no array function is chosen,
                or when a function supports index-or-whole choice (size, reverse) */}
            {childOfArrayToNonArray && (!isArrayFunctionSelected || arrayFuncSupportsIndexOrWhole.has(selectedFunction)) && (
                <Form style={{ marginBottom: '12px' }}>
                    <Text component={TextVariants.h4} style={{ marginBottom: '8px' }}>
                        {arrayFuncSupportsIndexOrWhole.has(selectedFunction) ? 'Apply To' : 'Index Selection'}
                    </Text>
                    <HelperText>
                        <HelperTextItem>
                            {arrayFuncSupportsIndexOrWhole.has(selectedFunction)
                                ? 'Choose to apply the function to the whole array or a specific indexed item.'
                                : 'Pick a single item from the source array to map.'}
                        </HelperTextItem>
                    </HelperText>
                    {arrayFuncSupportsIndexOrWhole.has(selectedFunction) ? (
                        <>
                            <FormGroup label="Apply function to" fieldId="apply-to">
                                <FormSelect
                                    value={localIndexSelector ? 'indexed' : 'array'}
                                    onChange={(_e, val) => {
                                        if (val === 'array') {
                                            setLocalIndexSelector(undefined);
                                            setLocalIndexValue(undefined);
                                        } else {
                                            setLocalIndexSelector('first');
                                            setLocalIndexValue(undefined);
                                        }
                                    }}
                                    id="apply-to"
                                >
                                    <FormSelectOption value="array" label="Whole array" />
                                    <FormSelectOption value="indexed" label="Specific index" />
                                </FormSelect>
                            </FormGroup>
                            {localIndexSelector && (
                                <FormGroup label="Index" fieldId="index-selection">
                                    <FormSelect value={localIndexSelector || 'first'} onChange={(_e, val) => setLocalIndexSelector((val as IndexSelector) || 'first')} id="index-selection">
                                        <FormSelectOption value="first" label="First (0)" />
                                        <FormSelectOption value="last" label="Last" />
                                        <FormSelectOption value="custom" label="Custom index" />
                                    </FormSelect>
                                    {localIndexSelector === 'custom' && (
                                        <TextInput
                                            type="number"
                                            value={localIndexValue !== undefined ? String(localIndexValue) : ''}
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
                                                setLocalIndexValue(v === '' ? undefined : Number(v));
                                            }}
                                            id="index-value"
                                            style={{ marginTop: 8 }}
                                        />
                                    )}
                                </FormGroup>
                            )}
                        </>
                    ) : (
                        <FormGroup label="Index" fieldId="index-selection">
                            <FormSelect value={localIndexSelector || 'first'} onChange={(_e, val) => setLocalIndexSelector((val as IndexSelector) || 'first')} id="index-selection">
                                <FormSelectOption value="first" label="First (0)" />
                                <FormSelectOption value="last" label="Last" />
                                <FormSelectOption value="custom" label="Custom index" />
                            </FormSelect>
                            {localIndexSelector === 'custom' && (
                                <TextInput
                                    type="number"
                                    value={localIndexValue !== undefined ? String(localIndexValue) : ''}
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
                                        setLocalIndexValue(v === '' ? undefined : Number(v));
                                    }}
                                    id="index-value"
                                    style={{ marginTop: 8 }}
                                />
                            )}
                        </FormGroup>
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
