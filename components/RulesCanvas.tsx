
import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Arrangement, EntityType, EvaluatedRule } from '../types';
import { COLORS } from '../constants';
import { ZoomIn, ZoomOut, Maximize, RefreshCw, Play, Pause, Hand, BoxSelect, Shield, Network } from 'lucide-react';

interface RulesCanvasProps {
  arrangement: Arrangement;
  evaluatedRules: EvaluatedRule[];
  width: number;
  height: number;
  onNodeClick: (type: EntityType, id: string, multiSelect: boolean) => void;
  selectedEntityIds?: string[];
}

interface LogicNode extends d3.SimulationNodeDatum {
  id: string;
  type: EntityType.RULE | EntityType.PREDICATE | 'OPERATOR';
  label: string;
  description?: string;
  color: string;
  stroke: string;
  shape: 'RECT' | 'DIAMOND' | 'CIRCLE';
  opacity: number;
  status?: string;
  isSelected: boolean;
  // Explicitly add d3 properties
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface LogicLink extends d3.SimulationLinkDatum<LogicNode> {
  id: string;
  source: string | LogicNode;
  target: string | LogicNode;
  isStrong: boolean;
  color: string;
}

export const RulesCanvas: React.FC<RulesCanvasProps> = ({ 
  arrangement, 
  evaluatedRules, 
  width, 
  height, 
  onNodeClick, 
  selectedEntityIds = []
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGRectElement, unknown> | null>(null);
  const zoomSelectionRef = useRef<d3.Selection<SVGRectElement, unknown, null, undefined> | null>(null);
  const simulationRef = useRef<d3.Simulation<LogicNode, undefined> | null>(null);
  const gRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  
  const nodesRef = useRef<LogicNode[]>([]);
  const particleSystemRef = useRef<any>(null);

  // STATE PERSISTENCE REFS
  const zoomTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
  const nodePositionsRef = useRef<Map<string, {x: number, y: number, fx?: number|null, fy?: number|null}>>(new Map());

  // Interaction State
  const [animationsEnabled, setAnimationsEnabled] = useState(true);
  const [dragEnabled, setDragEnabled] = useState(true);

  // --- PHYSICS ENGINE CONFIGURATION ---
  useEffect(() => {
    if (simulationRef.current) {
        if (animationsEnabled) {
            simulationRef.current.alpha(0.3).restart();
            startParticleSystem();
        } else {
            simulationRef.current.stop();
            stopParticleSystem();
        }
    }
    return () => stopParticleSystem();
  }, [animationsEnabled]);

  // --- PARTICLE SYSTEM ---
  const startParticleSystem = () => {
      if (particleSystemRef.current) return;
      
      particleSystemRef.current = setInterval(() => {
          if (!gRef.current) return;
          const links = gRef.current.selectAll(".logic-link") as d3.Selection<SVGLineElement, LogicLink, SVGGElement, unknown>;
          
          links.each(function(d) {
              if (Math.random() > 0.15) return; // Control density

              const line = d3.select(this);
              const x1 = parseFloat(line.attr("x1"));
              const y1 = parseFloat(line.attr("y1"));
              const x2 = parseFloat(line.attr("x2"));
              const y2 = parseFloat(line.attr("y2"));

              if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2)) return;

              // Determine particle color based on rule status if source is rule
              let pColor = "#94a3b8"; // Default Slate
              const src = d.source as LogicNode;
              if (src.type === EntityType.RULE && src.status === 'FAILED') pColor = "#ef4444";
              if (src.type === EntityType.RULE && src.status === 'PASSED') pColor = "#10b981";

              const particle = d3.select(line.node()!.parentNode as Element).append("circle")
                  .attr("r", 2)
                  .attr("fill", pColor)
                  .attr("filter", "url(#glow-particle-logic)")
                  .attr("cx", x1)
                  .attr("cy", y1);

              particle.transition()
                  .duration(1000 + Math.random() * 500)
                  .ease(d3.easeLinear)
                  .attr("cx", x2)
                  .attr("cy", y2)
                  .on("end", function() { d3.select(this).remove(); });
          });
      }, 300);
  };

  const stopParticleSystem = () => {
      if (particleSystemRef.current) {
          clearInterval(particleSystemRef.current);
          particleSystemRef.current = null;
      }
  };

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // 1. DEFS
    const defs = svg.append("defs");
    
    // Grid Pattern
    const pattern = defs.append("pattern")
        .attr("id", "grid-rules")
        .attr("width", 40)
        .attr("height", 40)
        .attr("patternUnits", "userSpaceOnUse");
    pattern.append("path")
        .attr("d", "M 40 0 L 0 0 0 40")
        .attr("fill", "none")
        .attr("stroke", "#1e293b")
        .attr("stroke-width", 0.5);

    // Glow Filters
    const filter = defs.append("filter").attr("id", "glow-logic");
    filter.append("feGaussianBlur").attr("stdDeviation", "2.5").attr("result", "coloredBlur");
    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "coloredBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    const particleFilter = defs.append("filter").attr("id", "glow-particle-logic");
    particleFilter.append("feGaussianBlur").attr("stdDeviation", "1.5").attr("result", "coloredBlur");
    particleFilter.append("feMerge").append("feMergeNode").attr("in", "coloredBlur");
    particleFilter.append("feMerge").append("feMergeNode").attr("in", "SourceGraphic");

    // Markers
    defs.append("marker")
      .attr("id", "arrow-rule")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 28)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("fill", "#475569")
      .attr("d", "M0,-5L10,0L0,5");

    // Zoom Container
    const g = svg.append("g");
    gRef.current = g;

    const zoom = d3.zoom<SVGRectElement, unknown>()
            .scaleExtent([0.1, 4])
            .on("zoom", (event) => {
                g.attr("transform", event.transform);
                zoomTransformRef.current = event.transform; 
            });
    zoomBehaviorRef.current = zoom;

    const rect = svg.append("rect")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("fill", "url(#grid-rules)")
        .style("pointer-events", "all") 
        .call(zoom)
        .on("dblclick.zoom", null);
    
    rect.call(zoom.transform, zoomTransformRef.current);
    zoomSelectionRef.current = rect;

    // 2. DATA PREPARATION
    const nodes: LogicNode[] = [];
    const links: LogicLink[] = [];

    // Predicates
    arrangement.predicates.forEach(p => {
      const isSelected = selectedEntityIds.includes(p.id);
      const prev = nodePositionsRef.current.get(p.id);
      nodes.push({
        id: p.id,
        type: EntityType.PREDICATE,
        label: p.label,
        description: p.description,
        color: COLORS.predicate,
        stroke: '#475569',
        shape: 'RECT',
        opacity: selectedEntityIds.length > 0 && !isSelected ? 0.4 : 1,
        isSelected,
        x: prev?.x, y: prev?.y, fx: prev?.fx, fy: prev?.fy
      });
    });

    // Rules
    arrangement.container.activeRules.forEach(r => {
      const evalRule = evaluatedRules.find(er => er.id === r.id);
      const status = evalRule ? evalRule.status : 'NOT_EVALUATED';
      
      let color = '#1e293b'; 
      let stroke = COLORS.rule;

      if (status === 'FAILED') {
          color = '#450a0a'; 
          stroke = '#ef4444'; 
      } else if (status === 'WARNING') {
          color = '#451a03'; 
          stroke = '#f97316'; 
      } else if (status === 'PASSED') {
          color = '#064e3b'; 
          stroke = '#10b981'; 
      }

      const isSelected = selectedEntityIds.includes(r.id);
      const prev = nodePositionsRef.current.get(r.id);
      
      nodes.push({
        id: r.id,
        type: EntityType.RULE,
        label: r.name, 
        color: color,
        stroke: stroke,
        shape: 'DIAMOND',
        opacity: selectedEntityIds.length > 0 && !isSelected ? 0.4 : 1,
        status: status,
        isSelected,
        x: prev?.x, y: prev?.y, fx: prev?.fx, fy: prev?.fy
      });

      // Links & Operators
      if (r.predicateIds && r.predicateIds.length > 0) {
        if (r.predicateIds.length > 1) {
            const opId = `${r.id}_op`;
            const prevOp = nodePositionsRef.current.get(opId);
            nodes.push({
                id: opId,
                type: 'OPERATOR',
                label: r.operator || 'AND',
                color: '#0f172a',
                stroke: '#475569',
                shape: 'CIRCLE',
                opacity: selectedEntityIds.length > 0 && !isSelected ? 0.4 : 1,
                isSelected: false,
                x: prevOp?.x, y: prevOp?.y, fx: prevOp?.fx, fy: prevOp?.fy
            });

            links.push({ id: `${r.id}-${opId}`, source: r.id, target: opId, isStrong: true, color: '#475569' });
            r.predicateIds.forEach(pid => {
                links.push({ id: `${opId}-${pid}`, source: opId, target: pid, isStrong: true, color: '#475569' });
            });
        } else {
             const pid = r.predicateIds[0];
             links.push({ id: `${r.id}-${pid}`, source: r.id, target: pid, isStrong: true, color: '#475569' });
        }
      }
    });
    
    nodesRef.current = nodes;

    // 3. SIMULATION
    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((d: any) => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-500))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius(d => (d as LogicNode).shape === 'RECT' ? 80 : 50))
      .force("y", d3.forceY().strength(0.05))
      .stop();

    simulationRef.current = simulation;

    // Initial Warmup if needed
    if (nodes.filter(n => n.x !== undefined).length < nodes.length * 0.8) {
        for (let i = 0; i < 100; ++i) simulation.tick();
    }

    // 4. DRAWING
    const linkGroup = g.append("g").attr("class", "links");
    const nodeGroup = g.append("g").attr("class", "nodes");
    const labelGroup = g.append("g").attr("class", "labels");

    // Links
    const link = linkGroup.selectAll("line")
      .data(links)
      .enter().append("line")
      .attr("class", "logic-link")
      .attr("stroke-width", 1.5)
      .attr("stroke", d => d.color)
      .attr("stroke-opacity", 0.4)
      .attr("marker-end", "url(#arrow-rule)");

    // Nodes
    const node = nodeGroup.selectAll("g")
      .data(nodes)
      .enter().append("g")
      .attr("opacity", d => d.opacity)
      .style("cursor", dragEnabled ? "grab" : "pointer")
      .call(d3.drag<SVGGElement, LogicNode>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

    node.each(function(d) {
      const el = d3.select(this);
      
      // Selection Indicator
      if (d.isSelected) {
         const haloColor = "#38bdf8";
         if (d.shape === 'RECT') {
             el.append("rect").attr("width", 154).attr("height", 46).attr("x", -77).attr("y", -23).attr("rx", 8)
              .attr("fill", "none").attr("stroke", haloColor).attr("stroke-width", 2).attr("stroke-dasharray", "4,3");
         } else if (d.shape === 'DIAMOND') {
             el.append("path").attr("d", "M0,-34 L34,0 L0,34 L-34,0 Z")
              .attr("fill", "none").attr("stroke", haloColor).attr("stroke-width", 2).attr("stroke-dasharray", "4,3");
         }
      }

      // -- PREDICATE (RECT) --
      if (d.shape === 'RECT') {
        // Shadow/Glow
        el.append("rect")
          .attr("width", 140).attr("height", 36).attr("x", -70).attr("y", -18).attr("rx", 6)
          .attr("fill", "#0f172a")
          .attr("stroke", d.stroke).attr("stroke-width", 1)
          .attr("filter", "url(#glow-logic)");

        // Main Body
        el.append("rect")
          .attr("width", 140).attr("height", 36).attr("x", -70).attr("y", -18).attr("rx", 6)
          .attr("fill", "#1e293b").attr("fill-opacity", 0.8)
          .attr("stroke", d.stroke).attr("stroke-width", 1);
          
        // Icon
        el.append("circle").attr("r", 8).attr("cx", -55).attr("cy", 0).attr("fill", "#334155");
        
        // Label
        el.append("text")
          .text(d.label)
          .attr("x", -40)
          .attr("font-size", "10px")
          .attr("font-family", "monospace")
          .attr("fill", "#e2e8f0")
          .attr("dy", "0.35em")
          .style("text-transform", "uppercase")
          .style("pointer-events", "none")
          .call(wrap, 100);

      // -- OPERATOR (CIRCLE) --
      } else if (d.shape === 'CIRCLE') {
        el.append("circle")
            .attr("r", 14)
            .attr("fill", "#0f172a")
            .attr("stroke", "#475569")
            .attr("stroke-width", 1);
        
        el.append("text")
            .text(d.label)
            .attr("font-size", "9px")
            .attr("fill", "#94a3b8")
            .attr("text-anchor", "middle")
            .attr("dy", "0.35em")
            .style("font-weight", "bold");

      // -- RULE (DIAMOND) --
      } else {
        // Outer Glow
        el.append("path")
          .attr("d", "M0,-28 L28,0 L0,28 L-28,0 Z")
          .attr("fill", "none")
          .attr("stroke", d.stroke)
          .attr("stroke-width", 2)
          .attr("filter", "url(#glow-logic)")
          .attr("opacity", 0.6);

        // Main Shape
        el.append("path")
          .attr("d", "M0,-28 L28,0 L0,28 L-28,0 Z")
          .attr("fill", d.color)
          .attr("stroke", d.stroke)
          .attr("stroke-width", 2);

        // Status Indicator (Small Dot)
        if (d.status === 'PASSED') {
             el.append("circle").attr("r", 3).attr("cy", 20).attr("fill", "#34d399");
        } else if (d.status === 'FAILED') {
             el.append("circle").attr("r", 3).attr("cy", 20).attr("fill", "#f87171");
        }

        // Label Pill
        const pillW = 80;
        el.append("rect")
            .attr("x", -pillW/2).attr("y", -6).attr("width", pillW).attr("height", 12).attr("rx", 4)
            .attr("fill", "#000").attr("fill-opacity", 0.4);

        el.append("text")
          .text(d.label)
          .attr("font-size", "9px")
          .attr("fill", "#ffffff")
          .attr("font-weight", "bold")
          .attr("text-anchor", "middle")
          .attr("dy", "0.35em")
          .style("pointer-events", "none")
          .call(wrap, 70);
      }
    });

    node.on("click", (e, d) => {
        if (d.type !== 'OPERATOR') {
             onNodeClick(d.type as EntityType, d.id, e.ctrlKey || e.metaKey);
        }
        e.stopPropagation();
    });

    // 5. TICK
    simulation.on("tick", () => {
      nodes.forEach(n => {
          if (n.id && n.x != null && n.y != null) {
              nodePositionsRef.current.set(n.id, { x: n.x, y: n.y, fx: n.fx, fy: n.fy });
          }
      });

      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    // Drag Logic
    function dragstarted(event: any, d: any) {
      if (!dragEnabled) return;
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
      d3.select(this).style("cursor", "grabbing");
    }

    function dragged(event: any, d: any) {
      if (!dragEnabled) return;
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: any, d: any) {
      if (!dragEnabled) return;
      if (!event.active) simulation.alphaTarget(0);
      d3.select(this).style("cursor", "grab");
    }

    function wrap(text: any, width: number) {
        text.each(function() {
          const t = d3.select(this);
          if (t.text().length * 6 > width) {
              t.text(t.text().slice(0, width/6) + "...");
          }
        });
    }

    startParticleSystem();

    return () => { 
        simulation.stop();
        stopParticleSystem();
    };
  }, [arrangement, evaluatedRules, width, height, selectedEntityIds, animationsEnabled, dragEnabled]);

  // --- CONTROLS ---
  const handleZoom = (factor: number) => {
      if (zoomSelectionRef.current && zoomBehaviorRef.current) {
          zoomSelectionRef.current.transition().duration(300).call(zoomBehaviorRef.current.scaleBy, factor);
      }
  };

  const handleFit = () => {
      if (!zoomSelectionRef.current || !zoomBehaviorRef.current || nodesRef.current.length === 0) return;
      const nodes = nodesRef.current;
      const minX = d3.min(nodes, n => n.x!) || 0;
      const maxX = d3.max(nodes, n => n.x!) || 0;
      const minY = d3.min(nodes, n => n.y!) || 0;
      const maxY = d3.max(nodes, n => n.y!) || 0;
      const contentWidth = maxX - minX + 200; 
      const contentHeight = maxY - minY + 200;
      const scale = Math.min(width / contentWidth, height / contentHeight);
      const translate = [width/2 - ((minX+maxX)/2)*scale, height/2 - ((minY+maxY)/2)*scale];

      zoomSelectionRef.current.transition().duration(750).call(
          zoomBehaviorRef.current.transform,
          d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
      );
  };

  const handleAutoArrange = () => {
      if (simulationRef.current) {
          nodePositionsRef.current.clear();
          nodesRef.current.forEach(n => { n.fx = null; n.fy = null; });
          simulationRef.current.alpha(1).restart();
      }
  };

  return (
    <div className="relative w-full h-full bg-slate-950 overflow-hidden">
        <svg ref={svgRef} width={width} height={height} style={{userSelect: 'none', cursor: dragEnabled ? 'default' : 'move'}} />
         
         <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex items-center gap-1 pointer-events-auto z-50">
             <div className="bg-slate-900/80 backdrop-blur border border-slate-700/50 rounded-full p-1.5 shadow-2xl flex items-center gap-1 transition-all hover:bg-slate-900 hover:border-slate-600">
                 
                 <button 
                    onClick={() => setDragEnabled(!dragEnabled)} 
                    className={`p-2 rounded-full hover:text-white transition-all ${dragEnabled ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:bg-slate-800'}`} 
                    title={dragEnabled ? "Node Dragging Enabled" : "Pan Mode"}
                >
                    {dragEnabled ? <Hand size={16} /> : <BoxSelect size={16} />}
                 </button>
                 <button 
                    onClick={() => setAnimationsEnabled(!animationsEnabled)} 
                    className={`p-2 rounded-full hover:text-white transition-all ${animationsEnabled ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-400 hover:bg-slate-800'}`} 
                    title={animationsEnabled ? "Physics Active" : "Physics Paused"}
                >
                    {animationsEnabled ? <Pause size={16} /> : <Play size={16} />}
                 </button>

                 <div className="h-4 w-px bg-slate-700 mx-1" />

                 <button onClick={handleFit} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors" title="Fit to Screen">
                    <Maximize size={16} />
                 </button>
                 <button onClick={handleAutoArrange} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors" title="Auto Layout">
                    <RefreshCw size={16} />
                 </button>
                 <button onClick={() => handleZoom(0.8)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors" title="Zoom Out">
                    <ZoomOut size={16} />
                 </button>
                 <button onClick={() => handleZoom(1.2)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors" title="Zoom In">
                    <ZoomIn size={16} />
                 </button>
             </div>
        </div>
    </div>
  );
};
