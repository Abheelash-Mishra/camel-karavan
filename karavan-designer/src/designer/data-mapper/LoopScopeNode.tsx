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
import { Handle, Position } from 'reactflow';

export interface LoopScopeNodeData {
  sourceArrayPath: string;
  targetArrayPath: string;
  description?: string;
}

export default function LoopScopeNode({ data }: { data: LoopScopeNodeData }) {
  return (
    <div style={{
      border: '2px dashed #6a6a6a',
      borderRadius: 8,
      padding: 12,
      width: 300,
      background: '#f8f8f8'
    }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Loop Scope</div>
      <div style={{ fontSize: 12, color: '#333' }}>
        <div><strong>Source:</strong> {data.sourceArrayPath}</div>
        <div><strong>Target:</strong> {data.targetArrayPath}</div>
        {data.description && <div style={{ marginTop: 6 }}>{data.description}</div>}
      </div>
      <Handle type="source" position={Position.Right} id="loop-out" />
      <Handle type="target" position={Position.Left} id="loop-in" />
    </div>
  );
}
