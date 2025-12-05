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

import { create } from 'zustand';
import { FieldMapping, SchemaData, ValidationWarning, ConstantValue, FieldDefinition, IndexSelector, ListMappingConfig } from './DataMapperTypes';

interface DataMapperState {
    sourceSchema?: SchemaData;
    targetSchema?: SchemaData;
    mappings: FieldMapping[];
    validationWarnings: ValidationWarning[];
    generatedJslt: string;
    selectedMapping?: string;
    showUploadModal: boolean;
    uploadModalType: 'source' | 'target';
    showJsltEditorModal: boolean;
    showTransformationPopup: boolean;
    showMultiSourcePopup: boolean;
    selectedMappingForTransform?: string;
    selectedTargetForMultiSource?: string;
    constants: ConstantValue[];
    customTargetFields: FieldDefinition[];
    showAddConstantModal: boolean;
    showAddTargetFieldModal: boolean;
    showListMappingModal: boolean;
    selectedFieldForListMapping?: string;
    listMappingConfigs: ListMappingConfig[];
}

interface DataMapperActions {
    setSourceSchema: (schema?: SchemaData) => void;
    setTargetSchema: (schema?: SchemaData) => void;
    addMapping: (mapping: FieldMapping) => void;
    updateMapping: (id: string, mapping: Partial<FieldMapping>) => void;
    removeMapping: (id: string) => void;
    setMappings: (mappings: FieldMapping[]) => void;
    addValidationWarning: (warning: ValidationWarning) => void;
    setValidationWarnings: (warnings: ValidationWarning[]) => void;
    clearValidationWarnings: () => void;
    setGeneratedJslt: (jslt: string) => void;
    setSelectedMapping: (id?: string) => void;
    setShowUploadModal: (show: boolean, type?: 'source' | 'target') => void;
    setShowJsltEditorModal: (show: boolean) => void;
    setShowTransformationPopup: (show: boolean, mappingId?: string) => void;
    setShowMultiSourcePopup: (show: boolean, targetFieldId?: string) => void;
    addConstant: (constant: ConstantValue) => void;
    removeConstant: (id: string) => void;
    updateConstant: (id: string, updates: Partial<ConstantValue>) => void;
    addCustomTargetField: (field: FieldDefinition) => void;
    removeCustomTargetField: (id: string) => void;
    updateCustomTargetField: (id: string, updates: Partial<FieldDefinition>) => void;
    setShowAddConstantModal: (show: boolean) => void;
    setShowAddTargetFieldModal: (show: boolean) => void;
    setShowListMappingModal: (show: boolean, fieldId?: string) => void;
    addListMappingConfig: (config: ListMappingConfig) => void;
    updateListMappingConfig: (id: string, config: ListMappingConfig) => void;
    removeListMappingConfig: (id: string) => void;
    clearAll: () => void;
    clearMappings: () => void;
}

const initialState: DataMapperState = {
    sourceSchema: undefined,
    targetSchema: undefined,
    mappings: [],
    validationWarnings: [],
    generatedJslt: '',
    selectedMapping: undefined,
    showUploadModal: false,
    uploadModalType: 'source',
    showJsltEditorModal: false,
    showTransformationPopup: false,
    showMultiSourcePopup: false,
    selectedMappingForTransform: undefined,
    selectedTargetForMultiSource: undefined,
    constants: [],
    customTargetFields: [],
    showAddConstantModal: false,
    showAddTargetFieldModal: false,
    showListMappingModal: false,
    selectedFieldForListMapping: undefined,
    listMappingConfigs: [],
};

export const useDataMapperStore = create<DataMapperState & DataMapperActions>((set) => ({
    ...initialState,

    setSourceSchema: (schema) => {
        // Set default values for fields
        if (schema) {
            const migrateFields = (fields: FieldDefinition[]): FieldDefinition[] => {
                return fields.map(field => {
                    const migratedField = {
                        ...field,
                        isExpanded: true // Always expanded in simplified UI
                    };
                    if (field.children) {
                        migratedField.children = migrateFields(field.children);
                    }
                    return migratedField;
                });
            };
            schema = {
                ...schema,
                fields: migrateFields(schema.fields)
            };
        }
        set({ sourceSchema: schema });
    },
    
    setTargetSchema: (schema) => {
        // Set default values for fields
        if (schema) {
            const migrateFields = (fields: FieldDefinition[]): FieldDefinition[] => {
                return fields.map(field => {
                    const migratedField = {
                        ...field,
                        isExpanded: true // Always expanded in simplified UI
                    };
                    if (field.children) {
                        migratedField.children = migrateFields(field.children);
                    }
                    return migratedField;
                });
            };
            schema = {
                ...schema,
                fields: migrateFields(schema.fields)
            };
        }
        set({ targetSchema: schema });
    },
    
    addMapping: (mapping) => set((state) => ({
        mappings: [...state.mappings, mapping]
    })),
    
    updateMapping: (id, updates) => set((state) => ({
        mappings: state.mappings.map(m => m.id === id ? { ...m, ...updates } : m)
    })),
    
    removeMapping: (id) => set((state) => ({
        mappings: state.mappings.filter(m => m.id !== id)
    })),
    
    setMappings: (mappings) => set({ mappings }),
    
    addValidationWarning: (warning) => set((state) => ({
        validationWarnings: [...state.validationWarnings, warning]
    })),
    
    setValidationWarnings: (warnings) => set({ validationWarnings: warnings }),
    
    clearValidationWarnings: () => set({ validationWarnings: [] }),
    
    setGeneratedJslt: (jslt) => set({ generatedJslt: jslt }),
    
    setSelectedMapping: (id) => set({ selectedMapping: id }),
    
    setShowUploadModal: (show, type = 'source') => set({ 
        showUploadModal: show, 
        uploadModalType: type 
    }),
    
    setShowJsltEditorModal: (show) => set({ showJsltEditorModal: show }),
    
    setShowTransformationPopup: (show, mappingId) => set({ 
        showTransformationPopup: show,
        selectedMappingForTransform: mappingId
    }),
    
    setShowMultiSourcePopup: (show, targetFieldId) => set({ 
        showMultiSourcePopup: show,
        selectedTargetForMultiSource: targetFieldId
    }),
    
    addConstant: (constant) => set((state) => ({
        constants: [...state.constants, constant]
    })),
    
    removeConstant: (id) => set((state) => ({
        constants: state.constants.filter(c => c.id !== id)
    })),
    
    updateConstant: (id, updates) => set((state) => ({
        constants: state.constants.map(c => c.id === id ? { ...c, ...updates } : c)
    })),
    
    addCustomTargetField: (field) => set((state) => ({
        customTargetFields: [...state.customTargetFields, field]
    })),
    
    removeCustomTargetField: (id) => set((state) => ({
        customTargetFields: state.customTargetFields.filter(f => f.id !== id)
    })),
    
    updateCustomTargetField: (id, updates) => set((state) => ({
        customTargetFields: state.customTargetFields.map(f => f.id === id ? { ...f, ...updates } : f)
    })),
    
    setShowAddConstantModal: (show) => set({ showAddConstantModal: show }),
    
    setShowAddTargetFieldModal: (show) => set({ showAddTargetFieldModal: show }),
    
    setShowListMappingModal: (show, fieldId) => set({ 
        showListMappingModal: show,
        selectedFieldForListMapping: fieldId
    }),
    
    addListMappingConfig: (config) => set((state) => ({
        listMappingConfigs: [...state.listMappingConfigs, config]
    })),
    
    updateListMappingConfig: (id, config) => set((state) => ({
        listMappingConfigs: state.listMappingConfigs.map(c => c.id === id ? config : c)
    })),
    
    removeListMappingConfig: (id) => set((state) => ({
        listMappingConfigs: state.listMappingConfigs.filter(c => c.id !== id)
    })),
    
    clearAll: () => set(initialState),
    
    clearMappings: () => set({ 
        mappings: [], 
        validationWarnings: [],
        generatedJslt: '',
        selectedMapping: undefined
    }),
}));
