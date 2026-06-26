
import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { Arrangement, EntityType, ImpactLevel, Alert, ServiceType, Link } from '../types';
import { COLORS } from '../constants';
import { ZoomIn, ZoomOut, Maximize, RefreshCw, Play, Pause, Hand, MousePointer2, BoxSelect } from 'lucide-react';

interface GraphCanvasProps {
  arrangement: Arrangement;
  width: number;
  height: number;
  onNodeClick: (type: EntityType, id: string, multiSelect: boolean) => void;
  onNodeContextMenu?: (event: React.MouseEvent | any, type: EntityType, id: string) => void;
  highlightedServiceIds?: string[];
  selectedEntityIds?: string[];
  alerts?: Alert[];
}

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  type: EntityType;
  serviceType?: ServiceType;
  label: string;
  radius: number;
  color: string;
  strokeColor: string;
  isExperimental?: boolean;
  opacity: number;
  isSelected: boolean;
  group?: string; 
  // D3 Props
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  id: string;
  source: string | GraphNode;
  target: string | GraphNode;
  opacity: number;
  type?: string;
}

export const GraphCanvas: React.FC<GraphCanvasProps> = ({ 
    arrangement, 
    width, 
    height, 
    onNodeClick, 
    onNodeContextMenu,
    highlightedServiceIds = [], 
    selectedEntityIds = [],
    alerts = []
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGRectElement, unknown> | null>(null);
  const zoomSelectionRef = useRef<d3.Selection<SVGRectElement, unknown, null, undefined> | null>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, undefined> | null>(null);
  const gRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  
  // STATE PERSISTENCE REFS
  const zoomTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
  const nodePositionsRef = useRef<Map<string, {x: number, y: number, fx?: number|null, fy?: number|null}>>(new Map());

  // Physics & Interaction State
  const [animationsEnabled, setAnimationsEnabled] = useState(true);
  const [dragEnabled, setDragEnabled] = useState(true);

  // References for D3 update pattern
  const nodesRef = useRef<GraphNode[]>([]);
  const particleSystemRef = useRef<any>(null);

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
      if (particleSystemRef.current) return; // Already running
      const canvas = d3.select(svgRef.current);
      // Simple loop to add particles
      particleSystemRef.current = setInterval(() => {
          if (!gRef.current) return;
          // Cast to specific Selection type instead of using generic function call to avoid "Untyped function calls..." error
          const links = gRef.current.selectAll(".link-path") as d3.Selection<SVGPathElement, GraphLink, SVGGElement, unknown>;
          
          links.each(function(d) {
              if (Math.random() > 0.3) return; // Not every link every tick
              if (d.opacity < 0.1) return; // Don't animate hidden links

              const path = this;
              const length = path.getTotalLength();
              if (!length) return;

              const particle = d3.select(path.parentNode as Element).append("circle")
                  .attr("r", 2)
                  .attr("fill", d.target instanceof Object && (d.target as GraphNode).isSelected ? "#fff" : "#60a5fa") // Bright blue or white
                  .attr("filter", "url(#glow-particle)");

              particle.transition()
                  .duration(1500 + Math.random() * 1000)
                  .ease(d3.easeLinear)
                  .attrTween("transform", function() {
                      return function(t) {
                          const point = path.getPointAtLength(t * length);
                          return `translate(${point.x},${point.y})`;
                      };
                  })
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

  // --- RENDER PIPELINE ---
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // 1. DEFS (Gradients, Filters, Patterns, Markers)
    const defs = svg.append("defs");
    
    // Grid Pattern
    const pattern = defs.append("pattern")
        .attr("id", "grid-graph-v2")
        .attr("width", 40)
        .attr("height", 40)
        .attr("patternUnits", "userSpaceOnUse");
    pattern.append("path")
        .attr("d", "M 40 0 L 0 0 0 40")
        .attr("fill", "none")
        .attr("stroke", "#1e293b")
        .attr("stroke-width", 0.5);

    // Glow Filter
    const filter = defs.append("filter").attr("id", "glow");
    filter.append("feGaussianBlur").attr("stdDeviation", "2.5").attr("result", "coloredBlur");
    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "coloredBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    const particleFilter = defs.append("filter").attr("id", "glow-particle");
    particleFilter.append("feGaussianBlur").attr("stdDeviation", "1.5").attr("result", "coloredBlur");
    particleFilter.append("feMerge").append("feMergeNode").attr("in", "coloredBlur");
    particleFilter.append("feMerge").append("feMergeNode").attr("in", "SourceGraphic");

    // Link Gradient
    const gradient = defs.append("linearGradient")
        .attr("id", "link-gradient")
        .attr("gradientUnits", "userSpaceOnUse");
    gradient.append("stop").attr("offset", "0%").attr("stop-color", "#475569").attr("stop-opacity", 0.2);
    gradient.append("stop").attr("offset", "100%").attr("stop-color", "#64748b").attr("stop-opacity", 0.6);

    // ARROW MARKER
    defs.append("marker")
        .attr("id", "arrow-head")
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 32) // Pushes arrow outside node radius (28)
        .attr("refY", 0)
        .attr("markerWidth", 8)
        .attr("markerHeight", 8)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", "#64748b");

    // 2. ZOOM & PAN LAYER
    const g = svg.append("g");
    gRef.current = g;

    const zoom = d3.zoom<SVGRectElement, unknown>()
        .scaleExtent([0.1, 4])
        .on("zoom", (event) => {
            g.attr("transform", event.transform);
            zoomTransformRef.current = event.transform; // Persist zoom state
        });
    zoomBehaviorRef.current = zoom;

    const bgRect = svg.append("rect")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("fill", "url(#grid-graph-v2)")
        .call(zoom)
        .on("dblclick.zoom", null); // Disable double click zoom
    
    // RESTORE ZOOM STATE
    bgRect.call(zoom.transform, zoomTransformRef.current);
    
    zoomSelectionRef.current = bgRect;

    // 3. DATA PREPARATION
    const hasHighlight = highlightedServiceIds.length > 0;

    const getImpactColor = (id: string) => {
        const rel = alerts.filter(a => a.provenance.includes(id));
        if (rel.some(a => a.severity === ImpactLevel.PROHIBITIVE)) return COLORS[ImpactLevel.PROHIBITIVE];
        if (rel.some(a => a.severity === ImpactLevel.UNDESIRABLE)) return COLORS[ImpactLevel.UNDESIRABLE];
        if (rel.some(a => a.severity === ImpactLevel.ACCEPTABLE)) return COLORS[ImpactLevel.ACCEPTABLE];
        return COLORS[ImpactLevel.NEUTRAL];
    };

    const nodes: GraphNode[] = arrangement.services.map(svc => {
        const isSelected = selectedEntityIds.includes(svc.id);
        const isImpacted = highlightedServiceIds.includes(svc.id);
        
        // Restore Previous Position if available
        const prev = nodePositionsRef.current.get(svc.id);

        let opacity = 1;
        if (hasHighlight) {
            opacity = (isSelected || isImpacted) ? 1 : 0.2;
        }

        return {
            id: svc.id,
            type: EntityType.SERVICE,
            serviceType: svc.type,
            label: svc.name,
            radius: 28,
            color: getImpactColor(svc.id),
            strokeColor: isSelected ? '#ffffff' : getImpactColor(svc.id),
            isExperimental: svc.isExperimental,
            opacity,
            isSelected,
            group: svc.group,
            // Restore physics state
            x: prev?.x,
            y: prev?.y,
            fx: prev?.fx,
            fy: prev?.fy
        };
    });
    nodesRef.current = nodes;

    // Use EXPLICIT links if available, otherwise fallback to empty to avoid confusing implicit links
    const explicitLinks = arrangement.links || [];
    
    const links: GraphLink[] = explicitLinks.map(l => {
        // Validation: Ensure source and target exist in nodes
        const srcExists = nodes.some(n => n.id === l.source);
        const tgtExists = nodes.some(n => n.id === l.target);
        
        if (!srcExists || !tgtExists) return null;

        let linkOpacity = 0.3;
        if (hasHighlight) {
            const related = highlightedServiceIds.includes(l.source) || highlightedServiceIds.includes(l.target);
            linkOpacity = related ? 0.6 : 0.05;
        }

        // Fixed type predicate error by casting mapped object to GraphLink to satisfy filter predicate
        return {
            id: `${l.source}-${l.target}`,
            source: l.source,
            target: l.target,
            opacity: linkOpacity,
            type: l.type
        } as GraphLink;
    }).filter((l): l is GraphLink => l !== null);


    // 4. SIMULATION SETUP
    const simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id((d: any) => d.id).strength(0.3).distance(150))
        .force("charge", d3.forceManyBody().strength(-800))
        .force("collide", d3.forceCollide().radius(60))
        .force("x", d3.forceX().strength(0.05)) // Centering x
        .force("y", d3.forceY().strength(0.05)); // Centering y

    simulationRef.current = simulation;

    // Warmup only if positions weren't largely restored
    const knownPositionsCount = nodes.filter(n => n.x !== undefined).length;
    if (knownPositionsCount < nodes.length * 0.8) {
        for(let i=0; i<30; i++) simulation.tick();
    }

    // 5. DRAWING LAYERS
    const groupLayer = g.append("g").attr("class", "groups");
    const linkLayer = g.append("g").attr("class", "links");
    const nodeLayer = g.append("g").attr("class", "nodes");

    // Group Rendering Logic
    const updateGroups = () => {
        // Calculate Bounding Boxes
        const groups: Record<string, {x0: number, x1: number, y0: number, y1: number}> = {};
        nodes.forEach(n => {
            if (!n.group) return;
            // Safe access for D3 coords
            // @ts-ignore
            const nx = n.x ?? 0, ny = n.y ?? 0;

            if (!groups[n.group]) groups[n.group] = {x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity};
            const g = groups[n.group];
            
            if (nx < g.x0) g.x0 = nx;
            if (nx > g.x1) g.x1 = nx;
            if (ny < g.y0) g.y0 = ny;
            if (ny > g.y1) g.y1 = ny;
        });

        const groupData = Object.entries(groups).map(([id, bounds]) => ({
            id,
            x: bounds.x0 - 40,
            y: bounds.y0 - 40,
            width: (bounds.x1 - bounds.x0) + 80,
            height: (bounds.y1 - bounds.y0) + 80
        }));

        const groupSel = groupLayer.selectAll("g.group-box").data(groupData, (d: any) => d.id);
        
        // Enter
        const groupEnter = groupSel.enter().append("g").attr("class", "group-box");
        groupEnter.append("rect")
            .attr("rx", 12)
            .attr("fill", "#0f172a") // Slate 900
            .attr("fill-opacity", 0.5)
            .attr("stroke", "#334155")
            .attr("stroke-width", 1)
            .attr("stroke-dasharray", "4,4");
        
        groupEnter.append("text")
            .text(d => d.id)
            .attr("fill", "#64748b")
            .attr("font-size", 10)
            .attr("font-weight", "bold")
            .attr("text-anchor", "start")
            .attr("dy", 15)
            .attr("dx", 10)
            .style("text-transform", "uppercase")
            .style("letter-spacing", "1px");

        // Update
        groupSel.select("rect")
            .attr("x", d => d.x).attr("y", d => d.y)
            .attr("width", d => d.width).attr("height", d => d.height);

        groupSel.select("text")
            .attr("x", d => d.x).attr("y", d => d.y);

        // Exit
        groupSel.exit().remove();
    };

    // Link Rendering
    const linkPath = linkLayer.selectAll("path")
        .data(links)
        .enter().append("path")
        .attr("class", "link-path")
        .attr("fill", "none")
        .attr("stroke-width", 2)
        .attr("stroke", "url(#link-gradient)")
        .attr("stroke-opacity", d => d.opacity)
        .attr("marker-end", "url(#arrow-head)");

    // Node Rendering
    const nodeG = nodeLayer.selectAll("g")
        .data(nodes)
        .enter().append("g")
        .attr("class", "node")
        .attr("opacity", d => d.opacity)
        .style("cursor", dragEnabled ? "grab" : "pointer")
        .call(d3.drag<SVGGElement, GraphNode>()
            .on("start", dragStarted)
            .on("drag", dragged)
            .on("end", dragEnded));

    nodeG.each(function(d) {
        const el = d3.select(this);
        
        // 1. Selection Halo
        if (d.isSelected) {
            el.append("circle")
                .attr("r", d.radius + 8)
                .attr("fill", "none")
                .attr("stroke", "#38bdf8") // Sky 400
                .attr("stroke-width", 1.5)
                .attr("stroke-dasharray", "3,3");
        }

        // 2. Outer Status Ring (Glow) with double ring for aesthetics
        el.append("circle")
            .attr("r", d.radius + 1)
            .attr("fill", "none")
            .attr("stroke", d.color)
            .attr("stroke-width", 1)
            .attr("opacity", 0.5)
            .attr("filter", "url(#glow)"); // Glow effect

        el.append("circle")
            .attr("r", d.radius)
            .attr("fill", "#020617") // Dark bg
            .attr("stroke", d.color)
            .attr("stroke-width", 2);

        // 3. Inner Circle (Glassy)
        const inner = el.append("circle")
            .attr("r", d.radius - 4)
            .attr("fill", "url(#link-gradient)")
            .attr("fill-opacity", 0.1);
        
        if (d.isSelected) inner.attr("fill-opacity", 0.3);

        // 4. Icon / Type
        el.append("text")
            .text(d.serviceType ? d.serviceType[0] : '?')
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle")
            .attr("font-weight", "900")
            .attr("font-size", "14px")
            .attr("fill", d.strokeColor)
            .style("text-shadow", "0 0 5px rgba(255,255,255,0.2)");

        // 5. Label (pill)
        const labelG = el.append("g").attr("transform", `translate(0, ${d.radius + 14})`);
        
        labelG.append("rect")
            .attr("rx", 4)
            .attr("ry", 4)
            .attr("x", -50).attr("y", -8)
            .attr("width", 100).attr("height", 16)
            .attr("fill", "#0f172a")
            .attr("opacity", 0.9)
            .attr("stroke", "#1e293b")
            .attr("stroke-width", 0.5);

        labelG.append("text")
            .text(d.label)
            .attr("text-anchor", "middle")
            .attr("dy", "0.35em")
            .attr("fill", "#e2e8f0")
            .attr("font-size", "9px")
            .attr("font-family", "monospace")
            .attr("font-weight", "bold")
            .call(wrap, 120);

        if (d.isExperimental) {
            el.append("text")
                .text("EXP")
                .attr("y", -d.radius - 8)
                .attr("text-anchor", "middle")
                .attr("font-size", "8px")
                .attr("fill", COLORS.serviceExperimental)
                .attr("font-weight", "bold");
        }
    });

    // Event Handlers
    nodeG.on("click", (e, d) => {
        e.stopPropagation();
        onNodeClick(d.type, d.id, e.ctrlKey || e.metaKey);
    });

    nodeG.on("contextmenu", (e, d) => {
        e.preventDefault();
        e.stopPropagation();
        if (onNodeContextMenu) onNodeContextMenu(e, d.type, d.id);
    });

    // Simulation Tick
    simulation.on("tick", () => {
        // SAVE POSITIONS
        nodes.forEach(n => {
            if (n.id && n.x != null && n.y != null) {
                nodePositionsRef.current.set(n.id, { x: n.x, y: n.y, fx: n.fx, fy: n.fy });
            }
        });

        // Update Links (Straight with Arrows)
        // Note: Using straight lines for DAG is often cleaner than curves when arrows are involved
        linkPath.attr("d", (d: any) => {
            return `M${d.source.x},${d.source.y} L${d.target.x},${d.target.y}`;
        });

        // Update Nodes
        nodeG.attr("transform", (d: any) => `translate(${d.x},${d.y})`);

        // Update Groups
        updateGroups();
    });

    // --- DRAG HANDLERS ---
    function dragStarted(event: any, d: any) {
        if (!dragEnabled) return;
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
        d3.select(this).style("cursor", "grabbing");
    }

    function dragged(event: any, d: any) {
        if (!dragEnabled) return;
        
        // Group Drag Logic: Drag all nodes in same group
        if (d.group) {
            const dx = event.x - d.x;
            const dy = event.y - d.y;
            nodes.forEach(n => {
                if (n.group === d.group && n.id !== d.id) {
                    n.fx = (n.x || 0) + dx;
                    n.fy = (n.y || 0) + dy;
                }
            });
        }
        
        d.fx = event.x;
        d.fy = event.y;
    }

    function dragEnded(event: any, d: any) {
        if (!dragEnabled) return;
        if (!event.active) simulation.alphaTarget(0);
        d3.select(this).style("cursor", "grab");
        
        // Release other nodes in group to settle
        if (d.group) {
             nodes.forEach(n => {
                if (n.group === d.group) {
                    // Optional: release them to physics? 
                    // n.fx = null; n.fy = null; 
                }
            });
        }
    }

    function wrap(text: any, width: number) {
        text.each(function() {
            // simple truncate
            const t = d3.select(this);
            const len = t.text().length;
            if (len > 15) {
                t.text(t.text().slice(0, 12) + "...");
            }
        });
    }

    // Initialize Particle System
    startParticleSystem();

    return () => {
        simulation.stop();
        stopParticleSystem();
    };

  }, [arrangement, width, height, onNodeClick, onNodeContextMenu, highlightedServiceIds, selectedEntityIds, alerts, animationsEnabled, dragEnabled]);

  // --- UI ACTIONS ---
  const handleZoom = (factor: number) => {
      if (zoomSelectionRef.current && zoomBehaviorRef.current) {
          zoomSelectionRef.current.transition().duration(300).call(zoomBehaviorRef.current.scaleBy, factor);
      }
  };

  const handleFit = () => {
      if (!zoomSelectionRef.current || !zoomBehaviorRef.current || nodesRef.current.length === 0) return;
      
      const nodes = nodesRef.current;
      const xExtent = d3.extent(nodes, n => n.x) as [number, number];
      const yExtent = d3.extent(nodes, n => n.y) as [number, number];
      
      if (xExtent[0] === undefined) return;

      const padding = 100;
      const boundsWidth = xExtent[1] - xExtent[0] + padding * 2;
      const boundsHeight = yExtent[1] - yExtent[0] + padding * 2;
      
      const midX = (xExtent[0] + xExtent[1]) / 2;
      const midY = (yExtent[0] + yExtent[1]) / 2;

      const scale = Math.min(width / boundsWidth, height / boundsHeight);
      const translate = [width / 2 - midX * scale, height / 2 - midY * scale];

      zoomSelectionRef.current.transition().duration(750).call(
          zoomBehaviorRef.current.transform,
          d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
      );
  };

  const handleAutoArrange = () => {
      if (simulationRef.current) {
          // Reset captured positions to allow re-flow
          nodePositionsRef.current.clear();
          nodesRef.current.forEach(n => { n.fx = null; n.fy = null; });
          simulationRef.current.alpha(1).restart();
      }
  };

  return (
    <div className="relative w-full h-full bg-slate-950 overflow-hidden">
        <svg ref={svgRef} width={width} height={height} style={{userSelect: 'none', cursor: dragEnabled ? 'default' : 'move'}} />
        
        {/* UNIFIED FLOATING CONTROLS (Bottom Center) */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex items-center gap-1 pointer-events-auto z-50">
             <div className="bg-slate-900/80 backdrop-blur border border-slate-700/50 rounded-full p-1.5 shadow-2xl flex items-center gap-1 transition-all hover:bg-slate-900 hover:border-slate-600">
                 
                 {/* Mode Toggles */}
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

                 {/* View Controls */}
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
