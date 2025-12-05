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

import { v4 as uuidv4 } from 'uuid';
import { FieldDefinition, FieldType, SchemaType } from './DataMapperTypes';

export class SchemaParser {
    
    /**
     * Parse JSON Schema or JSON instance into field definitions
     */
    static parse(content: any, schemaType: SchemaType, fileName: string): FieldDefinition[] {
        if (schemaType === 'json-schema') {
            return this.parseJsonSchema(content);
        } else {
            return this.parseJsonInstance(content);
        }
    }

    /**
     * Parse JSON Schema format
     */
    private static parseJsonSchema(schema: any, path: string = '', parentId?: string, depth: number = 1): FieldDefinition[] {
        const fields: FieldDefinition[] = [];

        if (!schema || typeof schema !== 'object') {
            return fields;
        }

        const type = this.normalizeJsonSchemaType(schema.type);
        const isArray = type === 'array';

        if (type === 'object' && schema.properties) {
            // Parse object properties - always include all children
            Object.keys(schema.properties).forEach(propName => {
                const propSchema = schema.properties[propName];
                // Use JSON Pointer style paths: '/prop' and nested '/parent/child'
                const propPath = path ? `${path}/${propName}` : `/${propName}`;
                const propType = this.normalizeJsonSchemaType(propSchema.type);
                const isPropArray = propType === 'array';

                const fieldId = uuidv4();
                const field: FieldDefinition = {
                    id: fieldId,
                    path: propPath,
                    name: propName,
                    // Parent array keeps type 'array' and isArray=true. Item structure is represented by an explicit child node.
                    type: isPropArray ? 'array' : propType,
                    isArray: isPropArray,
                    parent: parentId,
                    description: propSchema.description,
                    depth: depth,
                    isExpanded: true, // Always expanded in simplified UI
                };

                fields.push(field);

                // Recursively parse nested objects or array items
                if (propType === 'object' && propSchema.properties) {
                    const children = this.parseJsonSchema(propSchema, propPath, fieldId, depth + 1);
                    field.children = children;
                    fields.push(...children);
                } else if (isPropArray && propSchema.items) {
                    // Create explicit item node for arrays using JSON Pointer path '/.../items/*'
                    const arrayPath = `${propPath}/items/*`;
                    const itemType = this.normalizeJsonSchemaType(propSchema.items.type);
                    const itemId = uuidv4();
                    const itemField: FieldDefinition = {
                        id: itemId,
                        path: arrayPath,
                        name: `${propName}[]`,
                        type: itemType === 'array' ? 'array' : itemType,
                        isArray: false,
                        parent: fieldId,
                        description: propSchema.items?.description,
                        depth: depth + 1,
                        isExpanded: true,
                    };

                    // Parse item children and attach to the item node
                    const children = this.parseJsonSchema(propSchema.items, arrayPath, itemId, depth + 2);
                    itemField.children = children;

                    // Attach to parent and global list
                    field.children = [itemField, ...(children || [])];
                    fields.push(itemField);
                    fields.push(...(children || []));
                }
            });
        } else if (isArray && schema.items) {
            // Handle root-level arrays
            const arrayPath = path ? `${path}/items/*` : '/items/*';
            const children = this.parseJsonSchema(schema.items, arrayPath, parentId, depth + 1);
            fields.push(...children);
        }

        return fields;
    }

    /**
     * Parse JSON instance/sample
     */
    public static parseJsonInstance(json: any, path: string = '', parentId?: string, depth: number = 1): FieldDefinition[] {
        const fields: FieldDefinition[] = [];

        if (json === null || json === undefined) {
            return fields;
        }

        const type = this.getJsonInstanceType(json);

        if (type === 'object') {
            Object.keys(json).forEach(key => {
                const value = json[key];
                // Use JSON Pointer style
                const propPath = path ? `${path}/${key}` : `/${key}`;
                const valueType = this.getJsonInstanceType(value);
                const isArray = Array.isArray(value);

                const fieldId = uuidv4();
                const field: FieldDefinition = {
                    id: fieldId,
                    path: propPath,
                    name: key,
                    // Mark parent as array when value is array; item node will represent item structure
                    type: isArray ? 'array' : valueType,
                    isArray: isArray,
                    parent: parentId,
                    depth: depth,
                    isExpanded: true, // Always expanded in simplified UI
                };

                fields.push(field);

                // Recursively parse nested structures - always include all children
                if (valueType === 'object' && !isArray && value !== null) {
                    const children = this.parseJsonInstance(value, propPath, fieldId, depth + 1);
                    field.children = children;
                    fields.push(...children);
                } else if (isArray && value.length > 0 && value[0] !== null) {
                    const arrayPath = `${propPath}/items/*`;
                    const itemType = this.getJsonInstanceType(value[0]);
                    const itemId = uuidv4();

                    const itemField: FieldDefinition = {
                        id: itemId,
                        path: arrayPath,
                        name: `${key}[]`,
                        type: itemType === 'array' ? 'array' : itemType,
                        isArray: false,
                        parent: fieldId,
                        depth: depth + 1,
                        isExpanded: true,
                    };

                    if (itemType === 'object') {
                        const children = this.parseJsonInstance(value[0], arrayPath, itemId, depth + 2);
                        itemField.children = children;
                        field.children = [itemField, ...(children || [])];
                        fields.push(itemField);
                        fields.push(...(children || []));
                    } else {
                        field.children = [itemField];
                        fields.push(itemField);
                    }
                }
            });
        } else if (Array.isArray(json) && json.length > 0 && json[0] !== null) {
            // Handle root-level arrays
            const arrayPath = path ? `${path}/items/*` : '/items/*';
            const itemType = this.getJsonInstanceType(json[0]);
            if (itemType === 'object') {
                const children = this.parseJsonInstance(json[0], arrayPath, parentId, depth + 1);
                fields.push(...children);
            }
        }

        return fields;
    }

    /**
     * Normalize JSON Schema type to FieldType
     */
    private static normalizeJsonSchemaType(type: string | string[] | undefined): FieldType {
        if (!type) return 'unknown';
        const typeStr = Array.isArray(type) ? type[0] : type;
        
        switch (typeStr) {
            case 'string': return 'string';
            case 'number':
            case 'integer': return 'number';
            case 'boolean': return 'boolean';
            case 'object': return 'object';
            case 'array': return 'array';
            case 'null': return 'null';
            default: return 'unknown';
        }
    }

    /**
     * Get type of JSON instance value
     */
    private static getJsonInstanceType(value: any): FieldType {
        if (value === null) return 'null';
        if (Array.isArray(value)) return 'array';
        
        const jsType = typeof value;
        switch (jsType) {
            case 'string': return 'string';
            case 'number': return 'number';
            case 'boolean': return 'boolean';
            case 'object': return 'object';
            default: return 'unknown';
        }
    }

    /**
     * Get the type of items in an array
     */
    private static getArrayItemType(schema: any): FieldType {
        if (!schema || !schema.items) {
            return 'unknown';
        }
        
        if (schema.items.type) {
            return this.normalizeJsonSchemaType(schema.items.type);
        }
        
        // Try to infer from instance
        const itemType = this.getJsonInstanceType(schema.items);
        return itemType !== 'unknown' ? itemType : 'object'; // Default to object for complex items
    }

    /**
     * Flatten nested fields into a single array (for easier lookup)
     */
    static flattenFields(fields: FieldDefinition[]): FieldDefinition[] {
        const result: FieldDefinition[] = [];
        
        const flatten = (field: FieldDefinition) => {
            result.push(field);
            if (field.children) {
                field.children.forEach(flatten);
            }
        };

        fields.forEach(flatten);
        return result;
    }

    /**
     * Find field by path
     */
    static findFieldByPath(fields: FieldDefinition[], path: string): FieldDefinition | undefined {
        return fields.find(f => f.path === path);
    }

    /**
     * Find field by ID
     */
    static findFieldById(fields: FieldDefinition[], id: string): FieldDefinition | undefined {
        return fields.find(f => f.id === id);
    }
}
