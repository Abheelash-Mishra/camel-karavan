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
    operation?: ArrayIterationMode; // 'for-loop' (default) or 'index-access'
    indexSelector?: IndexSelector;
    indexValue?: number;
}

export interface FieldDefinition {
    id: string;
    path: string;
    name: string;
    type: FieldType;
    isArray: boolean;
    listMappingConfig?: ListMappingConfig;
    children?: FieldDefinition[];
    parent?: string;
    description?: string;
    isCustom?: boolean; // For user-added fields
    isExpanded?: boolean; // For array expand/collapse
    depth?: number; // Depth in the hierarchy for visual styling
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
    // Optional array index access (when mapping from arrays)
    indexSelector?: IndexSelector;
    indexValue?: number;
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

export interface JsltFunctionParam {
    name: string;
    description?: string;
    required?: boolean;
    placeholder?: string;
    default?: string;
}

export interface JsltFunctionDef {
    name: string;
    description: string;
    example: string;
    params?: JsltFunctionParam[];
}

export const JSLT_FUNCTIONS: JsltFunctionDef[] = [
    { name: 'index', description: 'Array index access (wraps expression with [index])', example: '(.array)[0]', params: [{ name: 'index', description: 'Index number or keywords: first, last', required: true, placeholder: '0' }] },
    { name: 'string-length', description: 'Returns length of a string', example: 'string-length(.)' },
    { name: 'split', description: 'Splits a string by a delimiter', example: 'split(., ",")', params: [{ name: 'delimiter', description: 'Delimiter string', required: true, placeholder: ',' }] },
    { name: 'join', description: 'Joins an array of strings using a delimiter', example: 'join(., ",")', params: [{ name: 'delimiter', description: 'Delimiter string', required: true, placeholder: ',' }] },
    { name: 'substring', description: 'Extracts a substring from a string', example: 'substring(., 0, 5)', params: [{ name: 'start', description: 'Start index', required: true, placeholder: '0' }, { name: 'end', description: 'End index', required: false, placeholder: '5' }] },

    { name: 'lower-case', description: 'Converts text to lowercase', example: 'lower-case(.)' },
    { name: 'upper-case', description: 'Converts text to uppercase', example: 'upper-case(.)' },

    { name: 'boolean', description: 'Converts a value to boolean', example: 'boolean(.)' },
    { name: 'number', description: 'Converts a value to number', example: 'number(.)' },
    { name: 'string', description: 'Converts a value to string', example: 'string(.)' },

    { name: 'sum', description: 'Sums numeric array elements', example: 'sum(.)' },
    { name: 'min', description: 'Returns minimum numeric value in array', example: 'min(.)' },
    { name: 'max', description: 'Returns maximum numeric value in array', example: 'max(.)' },

    { name: 'contains', description: 'Checks if a string contains a substring', example: 'contains(., "foo")', params: [{ name: 'substring', required: true, placeholder: 'foo' }] },
    { name: 'starts-with', description: 'Checks if string starts with a prefix', example: 'starts-with(., "abc")', params: [{ name: 'prefix', required: true, placeholder: 'abc' }] },
    { name: 'ends-with', description: 'Checks if string ends with a suffix', example: 'ends-with(., "xyz")', params: [{ name: 'suffix', required: true, placeholder: 'xyz' }] },

    { name: 'replace', description: 'Replaces substring using regex', example: 'replace(., "[0-9]+", "")', params: [{ name: 'pattern', required: true, placeholder: '[0-9]+' }, { name: 'replacement', required: true, placeholder: '' }] },
    { name: 'trim', description: 'Removes leading/trailing whitespace', example: 'trim(.)' },

    { name: 'round', description: 'Rounds to nearest integer', example: 'round(.)' },
    { name: 'floor', description: 'Rounds down', example: 'floor(.)' },
    { name: 'ceiling', description: 'Rounds up', example: 'ceiling(.)' },

    { name: 'keys', description: 'Returns keys of an object', example: 'keys(.)' },
    { name: 'values', description: 'Returns values of an object', example: 'values(.)' },
    { name: 'type', description: 'Returns the JSON type of a value', example: 'type(.)' }
];

