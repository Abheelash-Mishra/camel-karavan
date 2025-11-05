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
    TextInput,
    FormSelect,
    FormSelectOption,
    Switch,
} from '@patternfly/react-core';
import { v4 as uuidv4 } from 'uuid';
import { FieldDefinition, FieldType } from './DataMapperTypes';

interface AddTargetFieldModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (field: FieldDefinition) => void;
}

export function AddTargetFieldModal({ isOpen, onClose, onAdd }: AddTargetFieldModalProps) {
    const [name, setName] = useState('');
    const [type, setType] = useState<FieldType>('string');
    const [isArray, setIsArray] = useState(false);

    const handleAdd = () => {
        if (name.trim()) {
            const field: FieldDefinition = {
                id: `custom_${uuidv4()}`,
                name: name.trim(),
                path: name.trim(),
                type,
                isArray,
                isCustom: true,
            };
            onAdd(field);
            handleClose();
        }
    };

    const handleClose = () => {
        setName('');
        setType('string');
        setIsArray(false);
        onClose();
    };

    return (
        <Modal
            variant={ModalVariant.small}
            title="Add Target Field"
            isOpen={isOpen}
            onClose={handleClose}
            actions={[
                <Button key="add" variant="primary" onClick={handleAdd} isDisabled={!name.trim()}>
                    Add
                </Button>,
                <Button key="cancel" variant="link" onClick={handleClose}>
                    Cancel
                </Button>,
            ]}
        >
            <Form>
                <FormGroup label="Field Name" fieldId="field-name" isRequired>
                    <TextInput
                        id="field-name"
                        value={name}
                        onChange={(_event, value) => setName(value)}
                        placeholder="e.g., custom_field"
                    />
                </FormGroup>

                <FormGroup label="Type" fieldId="field-type">
                    <FormSelect
                        id="field-type"
                        value={type}
                        onChange={(_event, value) => setType(value as FieldType)}
                    >
                        <FormSelectOption value="string" label="String" />
                        <FormSelectOption value="number" label="Number" />
                        <FormSelectOption value="boolean" label="Boolean" />
                        <FormSelectOption value="object" label="Object" />
                        <FormSelectOption value="array" label="Array" />
                    </FormSelect>
                </FormGroup>

                <FormGroup label="Array" fieldId="field-array">
                    <Switch
                        id="field-array"
                        label="This field is an array"
                        isChecked={isArray}
                        onChange={(_event, checked) => setIsArray(checked)}
                    />
                </FormGroup>
            </Form>
        </Modal>
    );
}
