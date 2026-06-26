import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Arrangement } from '../types';

interface ForkTreeProps {
    arrangements: Arrangement[];
    activeId: string;
    onSelect: (id: string) => void;
}

export const ForkTree: React.FC<ForkTreeProps> = ({ arrangements, activeId, onSelect }) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!svgRef.current || !containerRef.current || arrangements.length === 0) return;
        
        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove(); // Clear previous render

        // Responsive width based on container
        const width = containerRef.current.clientWidth || 240;
        // Calculate height dynamically based on depth, or keep minimum
        const height = 180;

        // Create data hierarchy
        const dataMap = new Map<string, any>();
        arrangements.forEach(a => {
            dataMap.set(a.id, { 
                id: a.id, 
                name: a.container.versionLabel, 
                hypothesis: a.container.hypothesisName,
                parentId: a.parentId, 
                children: [] 
            });
        });

        let roots: any[] = [];
        arrangements.forEach(a => {
            const node = dataMap.get(a.id);
            if (node.parentId && dataMap.has(node.parentId)) {
                dataMap.get(node.parentId).children.push(node);
            } else {
                roots.push(node);
            }
        });

        // Virtual root to tie multiple projects together if necessary
        const rootData = { id: 'root', name: 'Virtual', children: roots };
        
        const root = d3.hierarchy<any>(rootData);
        
        // Depth mapping to expand height if tree gets too deep
        const maxDepth = root.height;
        const dynamicHeight = Math.max(height, maxDepth * 60 + 60);

        // Adjust SVG height
        svg.attr('height', dynamicHeight);

        // Setup tree layout
        const treeLayout = d3.tree<any>().size([width - 40, dynamicHeight - 60]);
        treeLayout(root);

        const g = svg.append('g').attr('transform', 'translate(20, 30)');

        // Draw Links
        g.selectAll('.link')
            .data(root.links())
            .enter()
            .filter(d => d.source.data.id !== 'root') // Hide links from virtual root
            .append('path')
            .attr('class', 'link')
            .attr('fill', 'none')
            .attr('stroke', '#334155') // slate-700
            .attr('stroke-width', 2)
            .attr('d', d3.linkVertical<any, any>()
                .x((d: any) => d.x)
                .y((d: any) => d.y)
            );

        // Draw Nodes
        const nodeGroup = g.selectAll('.node')
            .data(root.descendants())
            .enter()
            .filter(d => d.data.id !== 'root')
            .append('g')
            .attr('class', 'node')
            .attr('transform', (d: any) => `translate(${d.x}, ${d.y})`)
            .style('cursor', 'pointer')
            .on('click', (event, d) => onSelect(d.data.id));

        // Background for hover area
        nodeGroup.append('rect')
            .attr('x', -30)
            .attr('y', -10)
            .attr('width', 60)
            .attr('height', 30)
            .attr('fill', 'transparent');

        // Node Circle
        nodeGroup.append('circle')
            .attr('r', (d: any) => d.data.id === activeId ? 8 : 6)
            .attr('fill', (d: any) => d.data.id === activeId ? '#4f46e5' : '#1e293b') // indigo-600 vs slate-800
            .attr('stroke', (d: any) => d.data.id === activeId ? '#a5b4fc' : '#475569') // indigo-300 vs slate-600
            .attr('stroke-width', 2)
            .style('transition', 'all 0.2s ease');

        // Node Label
        nodeGroup.append('text')
            .attr('dy', 22)
            .attr('text-anchor', 'middle')
            .attr('fill', (d: any) => d.data.id === activeId ? '#a5b4fc' : '#94a3b8')
            .attr('font-size', '9px')
            .attr('font-weight', (d: any) => d.data.id === activeId ? 'bold' : 'normal')
            .attr('font-family', 'monospace')
            .text((d: any) => {
                const name = d.data.name as string;
                return name.length > 12 ? name.substring(0, 10) + '..' : name;
            });

    }, [arrangements, activeId, onSelect]);

    return (
        <div ref={containerRef} className="w-full bg-slate-900 border border-slate-800 rounded mb-4 overflow-hidden shadow-inner flex flex-col min-h-[160px] relative">
            <div className="absolute top-2 left-2 flex items-center gap-1.5 text-[9px] font-bold text-slate-500 uppercase tracking-wider z-10">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3v12"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>
                Fork Tree
            </div>
            <div className="flex-1 w-full overflow-y-auto custom-scrollbar">
                {arrangements.length > 0 ? (
                    <svg ref={svgRef} className="w-full" style={{ minHeight: '160px' }} />
                ) : (
                    <div className="h-full flex items-center justify-center text-[10px] text-slate-500 italic">No forks available</div>
                )}
            </div>
        </div>
    );
};
