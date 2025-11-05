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

import { FieldDefinition, FieldMapping, SchemaData, ListMappingConfig } from './DataMapperTypes';
import { SchemaParser } from './SchemaParser';

export class JsltGenerator {
    
    /**
     * Generate JSLT spec from mappings and schemas
     */
    static generate(
        sourceSchema: SchemaData | undefined,
        targetSchema: SchemaData | undefined,
        mappings: FieldMapping[],
        listMappingConfigs: ListMappingConfig[] = []
    ): string {
        if (!sourceSchema || !targetSchema || mappings.length === 0) {
            return '// No mappings defined\n.';
        }

        const sourceFields = SchemaParser.flattenFields(sourceSchema.fields);
        const targetFields = SchemaParser.flattenFields(targetSchema.fields);

        // Build the target structure
        const jslt = this.buildTargetStructure(targetFields, mappings, sourceFields, listMappingConfigs);
        
        return jslt;
    }

    /**
     * Build the target JSON structure from mappings
     */
    private static buildTargetStructure(
        targetFields: FieldDefinition[],
        mappings: FieldMapping[],
        sourceFields: FieldDefinition[],
        listMappingConfigs: ListMappingConfig[] = []
    ): string {
        const rootFields = targetFields.filter(f => !f.parent);
        
        if (rootFields.length === 0) {
            return '.';
        }

        // Check if root is an array
        const hasRootArray = rootFields.some(f => f.path.startsWith('[]'));
        
        if (hasRootArray) {
            return this.buildArrayMapping(rootFields, mappings, sourceFields, '[]');
        } else {
            return this.buildObjectMapping(rootFields, mappings, sourceFields, '');
        }
    }

    /**
     * Build object mapping
     */
    private static buildObjectMapping(
        fields: FieldDefinition[],
        mappings: FieldMapping[],
        sourceFields: FieldDefinition[],
        pathPrefix: string,
        listMappingConfigs: ListMappingConfig[] = []
    ): string {
        const lines: string[] = ['{'];
        const mappedFields = new Map<string, FieldDefinition>();

        // Group fields by direct children only
        const directChildren = fields.filter(f => {
            if (!pathPrefix) {
                return !f.path.includes('.') && !f.path.startsWith('[]');
            }
            const relativePath = f.path.replace(pathPrefix + '.', '');
            return !relativePath.includes('.') && f.path.startsWith(pathPrefix);
        });

        directChildren.forEach(field => {
            const fieldMappings = mappings.filter(m => m.targetFieldId === field.id);
            
            if (fieldMappings.length > 0) {
                const mapping = fieldMappings[0];
                const mappingExpr = this.buildMappingExpression(mapping, sourceFields);
                
                if (field.isArray) {
                    // Handle array field
                    const arrayChildren = fields.filter(f => 
                        f.path.startsWith(field.path + '[]') && f.parent === field.id
                    );
                    
                    if (arrayChildren.length > 0) {
                        // Array of objects
                        const arrayExpr = this.buildArrayMapping(arrayChildren, mappings, sourceFields, field.path);
                        lines.push(`  "${field.name}": ${arrayExpr},`);
                    } else {
                        // Simple array
                        lines.push(`  "${field.name}": ${mappingExpr},`);
                    }
                } else if (field.type === 'object' && field.children && field.children.length > 0) {
                    // Nested object
                    const objExpr = this.buildObjectMapping(fields, mappings, sourceFields, field.path);
                    lines.push(`  "${field.name}": ${objExpr},`);
                } else {
                    // Simple field
                    lines.push(`  "${field.name}": ${mappingExpr},`);
                }
                
                mappedFields.set(field.name, field);
            }
        });

        // Remove trailing comma from last line
        if (lines.length > 1) {
            const lastIdx = lines.length - 1;
            lines[lastIdx] = lines[lastIdx].replace(/,\s*$/, '');
        }

        lines.push('}');
        return lines.join('\n');
    }

    /**
     * Build array mapping with for-loop or index access
     */
    private static buildArrayMapping(
        fields: FieldDefinition[],
        mappings: FieldMapping[],
        sourceFields: FieldDefinition[],
        arrayPath: string
    ): string {
        // Find the array field definition
        const arrayField = fields.find(f => f.path === arrayPath.replace('[]', '') || f.path + '[]' === arrayPath);
        
        // Determine if we have list mapping configuration
        const childMappings = mappings.filter(m => {
            const targetField = fields.find(f => f.id === m.targetFieldId);
            return targetField && targetField.path.startsWith(arrayPath);
        });

        if (childMappings.length === 0) {
            return '[]';
        }

        // For now, use simple array element access
        const itemFields = fields.filter(f => f.path.startsWith(arrayPath));
        
        if (itemFields.length > 1 || itemFields.some(f => f.type === 'object')) {
            // Array of objects
            return `[${this.buildObjectMapping(itemFields, mappings, sourceFields, arrayPath)}]`;
        } else {
            // Simple array - direct mapping
            const mapping = childMappings[0];
            return this.buildMappingExpression(mapping, sourceFields);
        }
    }

    /**
     * Build mapping expression for a single field
     */
    private static buildMappingExpression(mapping: FieldMapping, sourceFields: FieldDefinition[]): string {
        if (mapping.multiSourceExpression) {
            // Multi-source concatenation
            return this.buildMultiSourceExpression(mapping, sourceFields);
        }

        const sourceField = sourceFields.find(f => f.id === mapping.sourceFieldIds[0]);
        if (!sourceField) {
            return 'null';
        }

        let expr = this.getJsltPath(sourceField.path);

        // Arrays now use direct path access without index selectors in simplified UI
        // The path already includes proper array notation from SchemaParser

        // Apply transformation if specified
        if (mapping.transformation) {
            expr = this.applyTransformation(expr, mapping.transformation);
        }

        return expr;
    }

    /**
     * Build multi-source expression (concatenation)
     */
    private static buildMultiSourceExpression(mapping: FieldMapping, sourceFields: FieldDefinition[]): string {
        if (!mapping.multiSourceExpression) {
            return 'null';
        }

        let expr = mapping.multiSourceExpression;
        
        // Replace source field placeholders with JSLT paths
        mapping.sourceFieldIds.forEach((sourceId, index) => {
            const sourceField = sourceFields.find(f => f.id === sourceId);
            if (sourceField) {
                const jsltPath = this.getJsltPath(sourceField.path);
                const placeholder = `source${index + 1}`;
                expr = expr.replace(new RegExp(placeholder, 'g'), jsltPath);
            }
        });

        return expr;
    }

    /**
     * Apply JSLT transformation function
     */
    private static applyTransformation(expr: string, transformation: { name: string; parameters?: string[] }): string {
        const { name, parameters = [] } = transformation;
        
        if (parameters.length > 0) {
            const params = parameters.map(p => `"${p}"`).join(', ');
            return `${name}(${expr}, ${params})`;
        } else {
            return `${name}(${expr})`;
        }
    }

    /**
     * Convert field path to JSLT path
     */
    private static getJsltPath(fieldPath: string): string {
        if (!fieldPath || fieldPath === '') {
            return '.';
        }

        // Handle array notation
        const path = fieldPath
            .replace(/\[\]/g, '')  // Remove array brackets for now
            .split('.')
            .filter(p => p)
            .map(p => `.${p}`)
            .join('');

        return path || '.';
    }

    /**
     * Get variable name for array item in for-loop
     */
    private static getArrayItemVariable(fieldPath: string): string {
        const parts = fieldPath.replace(/\[\]/g, '').split('.').filter(p => p);
        const lastPart = parts[parts.length - 1] || 'item';
        return lastPart;
    }

    /**
     * Validate generated JSLT
     */
    static validate(jslt: string): { valid: boolean; errors: string[] } {
        const errors: string[] = [];
        
        // Basic syntax validation
        if (!jslt || jslt.trim() === '') {
            errors.push('JSLT spec is empty');
        }

        // Check balanced braces
        const openBraces = (jslt.match(/{/g) || []).length;
        const closeBraces = (jslt.match(/}/g) || []).length;
        if (openBraces !== closeBraces) {
            errors.push('Unbalanced curly braces');
        }

        // Check balanced brackets
        const openBrackets = (jslt.match(/\[/g) || []).length;
        const closeBrackets = (jslt.match(/]/g) || []).length;
        if (openBrackets !== closeBrackets) {
            errors.push('Unbalanced square brackets');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Build list-to-list mapping using ListMappingConfig
     */
    private static buildListToListMapping(config: ListMappingConfig, sourceFields: FieldDefinition[]): string {
        const sourceArrayPath = this.getJsltPath(config.sourceArrayPath);
        
        // Build the inner object mapping using the field mappings from the config
        const fieldMappingLines: string[] = [];
        
        for (const mapping of config.fieldMappings) {
            const sourceField = sourceFields.find(f => f.id === mapping.sourceFieldIds[0]);
            if (sourceField) {
                // Get the field name without the array path prefix
                const targetFieldName = mapping.targetFieldId.split('.').pop() || mapping.targetFieldId;
                const sourceExpression = this.buildMappingExpression(mapping, sourceFields);
                
                // Replace the array path with current item reference
                const itemExpression = sourceExpression.replace(
                    this.getJsltPath(config.sourceArrayPath),
                    '.'
                );
                
                fieldMappingLines.push(`  "${targetFieldName}": ${itemExpression}`);
            }
        }
        
        if (fieldMappingLines.length === 0) {
            return `[for (${sourceArrayPath}) .]`;
        }
        
        const objectMapping = `{\n${fieldMappingLines.join(',\n')}\n}`;
        return `[for (${sourceArrayPath}) ${objectMapping}]`;
    }
}
