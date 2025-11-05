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

export type FieldType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null' | 'unknown';

export type ArrayIterationMode = 'for-loop' | 'index-access' | 'direct';

export type IndexSelector = 'first' | 'second' | 'third' | 'last' | 'custom';

export type SchemaType = 'json-schema' | 'json-instance';

export interface ListMappingConfig {
    id: string;
    sourceArrayPath: string;
    targetArrayPath: string;
    fieldMappings: FieldMapping[];
    nestedLevel: number; // Support up to 3 levels of nesting
}

export interface FieldDefinition {
    id: string;
    path: string;
    name: string;
    type: FieldType;
    isArray: boolean;
    arrayIterationMode?: ArrayIterationMode;
    indexSelector?: IndexSelector;
    customIndex?: number;
    listMappingConfig?: ListMappingConfig;
    children?: FieldDefinition[];
    parent?: string;
    description?: string;
    isCustom?: boolean; // For user-added fields
}

export interface ConstantValue {
    id: string;
    name: string;
    value: string;
    type: FieldType;
}

export interface FieldMapping {
    id: string;
    sourceFieldIds: string[];
    targetFieldId: string;
    transformation?: TransformationFunction;
    multiSourceExpression?: string;
    typeWarning?: string;
    constantSourceIds?: string[]; // IDs of constant values used as sources
}

export interface TransformationFunction {
    name: string;
    parameters?: string[];
}

export interface ValidationWarning {
    id: string;
    message: string;
    line?: number;
    severity: 'warning' | 'error' | 'info';
}

export interface SchemaData {
    type: SchemaType;
    fileName: string;
    content: any;
    fields: FieldDefinition[];
}

export const JSLT_FUNCTIONS = [
    { name: 'size', description: 'Returns the size of an array or string', example: 'size(.)' },
    { name: 'contains', description: 'Checks if a string contains a substring', example: 'contains(., "text")' },
    { name: 'split', description: 'Splits a string by delimiter', example: 'split(., ",")' },
    { name: 'join', description: 'Joins an array into a string', example: 'join(., ",")' },
    { name: 'substring', description: 'Extracts a substring', example: 'substring(., 0, 5)' },
    { name: 'trim', description: 'Removes whitespace from both ends', example: 'trim(.)' },
    { name: 'round', description: 'Rounds a number to nearest integer', example: 'round(.)' },
    { name: 'floor', description: 'Rounds down to nearest integer', example: 'floor(.)' },
    { name: 'ceil', description: 'Rounds up to nearest integer', example: 'ceil(.)' },
    { name: 'boolean', description: 'Converts value to boolean', example: 'boolean(.)' },
    { name: 'number', description: 'Converts value to number', example: 'number(.)' },
    { name: 'string', description: 'Converts value to string', example: 'string(.)' },
    { name: 'lowercase', description: 'Converts string to lowercase', example: 'lowercase(.)' },
    { name: 'uppercase', description: 'Converts string to uppercase', example: 'uppercase(.)' },
    { name: 'sum', description: 'Sums array elements', example: 'sum(.)' },
    { name: 'min', description: 'Returns minimum value from array', example: 'min(.)' },
    { name: 'max', description: 'Returns maximum value from array', example: 'max(.)' },
];
