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
    TextArea,
    HelperText,
    HelperTextItem,
} from '@patternfly/react-core';
import { FieldDefinition } from './DataMapperTypes';

interface MultiSourcePopupProps {
    isOpen: boolean;
    sourceFieldIds: string[];
    sourceFields?: FieldDefinition[];
    currentExpression?: string;
    onClose: () => void;
    onApply: (expression: string) => void;
}

export function MultiSourcePopup({ 
    isOpen, 
    sourceFieldIds,
    sourceFields,
    currentExpression, 
    onClose, 
    onApply 
}: MultiSourcePopupProps) {
    const [expression, setExpression] = useState(currentExpression || '');

    // Helper to find field by ID
    const findFieldById = (fieldId: string, fields?: FieldDefinition[]): FieldDefinition | undefined => {
        if (!fields) return undefined;
        for (const field of fields) {
            if (field.id === fieldId) return field;
            if (field.children) {
                const found = findFieldById(fieldId, field.children);
                if (found) return found;
            }
        }
        return undefined;
    };

    // Get actual field paths for placeholders (convert JSON Pointer style to dot-style for display)
    const getFieldPath = (fieldId: string): string => {
        const field = findFieldById(fieldId, sourceFields);
        const p = field?.path || fieldId;
        // Convert JSON Pointer '/order/id' -> '.order.id' for display
        if (typeof p === 'string' && p.startsWith('/')) {
            const body = p.replace(/^\//, '').replace(/\//g, '.');
            return body.startsWith('.') ? body : `.${body}`;
        }
        // Fallback: convert dot-array notation or other separators and ensure leading dot
        const converted = String(p).replace(/\[\]/g, '').replace(/\//g, '.');
        return converted.startsWith('.') ? converted : `.${converted}`;
    };

    const sourcePlaceholders = sourceFieldIds.map((id, index) => ({
        placeholder: `source${index + 1}`,
        actualPath: getFieldPath(id),
    }));

    React.useEffect(() => {
        if (isOpen && !currentExpression) {
            const template = sourcePlaceholders.map(s => s.placeholder).join(' + " " + ');
            setExpression(template);
        } else {
            setExpression(currentExpression || '');
        }
    }, [currentExpression, isOpen, sourceFieldIds]);

    const handleApply = () => {
        if (expression.trim()) {
            onApply(expression);
        }
        onClose();
    };

    return (
        <Modal
            variant={ModalVariant.small}
            title="Configure Multi-Source Mapping"
            isOpen={isOpen}
            onClose={onClose}
            actions={[
                <Button key="apply" variant="primary" onClick={handleApply}>
                    Apply
                </Button>,
                <Button key="cancel" variant="link" onClick={onClose}>
                    Cancel
                </Button>,
            ]}
        >
            <Form>
                <FormGroup 
                    label="Expression" 
                    fieldId="expression"
                >
                    <TextArea
                        id="expression"
                        value={expression}
                        onChange={(_event, value) => setExpression(value)}
                        placeholder={`Example: source1 + " " + source2`}
                        rows={5}
                    />
                    <HelperText>
                        <HelperTextItem>
                            Use placeholders:
                            {sourcePlaceholders.map(s => (
                                <div key={s.placeholder}>
                                    <strong>{s.placeholder}</strong> = {s.actualPath}
                                </div>
                            ))}
                        </HelperTextItem>
                        <HelperTextItem>
                            Examples:<br/>
                            • Concatenation: {sourcePlaceholders[0]?.placeholder} + " " + {sourcePlaceholders[1]?.placeholder}<br/>
                            • With separator: {sourcePlaceholders[0]?.placeholder} + ", " + {sourcePlaceholders[1]?.placeholder}<br/>
                            • Nested: {sourcePlaceholders[0]?.placeholder} + " (" + {sourcePlaceholders[1]?.placeholder} + ")"
                        </HelperTextItem>
                    </HelperText>
                </FormGroup>
            </Form>
        </Modal>
    );
}
