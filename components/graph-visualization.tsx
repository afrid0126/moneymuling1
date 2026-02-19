"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnalysisResult } from "@/lib/types";

interface GraphVisualizationProps {
  result: AnalysisResult;
}

interface NodeObject {
  id: string;
  name: string;
  suspicious: boolean;
  suspicionScore: number;
  patterns: string[];
  ringId: string;
  val: number;
  color: string;
  x?: number;
  y?: number;
}

interface LinkObject {
  source: string;
  target: string;
  amount: number;
  color: string;
  curvature: number;
}

export function GraphVisualization({ result }: GraphVisualizationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [hoveredNode, setHoveredNode] = useState<NodeObject | null>(null);
  const [ForceGraph, setForceGraph] = useState<any>(null);
  const initDone = useRef(false);

  useEffect(() => {
    import("react-force-graph-2d").then((mod) => {
      setForceGraph(() => mod.default);
    });
  }, []);

  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: 600,
        });
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const suspiciousMap = useMemo(
    () => new Map(result.suspicious_accounts.map((a) => [a.account_id, a])),
    [result.suspicious_accounts]
  );

  const ringColorMap = useMemo(() => {
    const map = new Map<string, string>();
    const ringColors = [
      "#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6",
      "#8b5cf6", "#ec4899", "#14b8a6", "#f43f5e", "#6366f1",
    ];
    result.fraud_rings.forEach((ring, i) => {
      map.set(ring.ring_id, ringColors[i % ringColors.length]);
    });
    return map;
  }, [result.fraud_rings]);

  const graphData = useMemo(() => {
    console.log("[Graph Viz] Building graph data...");

    const nodes: NodeObject[] = Array.from(result.graph.nodes.keys()).map(
      (id) => {
        const account = suspiciousMap.get(id);
        const isSuspicious = !!account;
        const score = account?.suspicion_score || 0;
        const ringId = account?.ring_id || "";

        let color = "#4b5563";
        if (isSuspicious) {
          color =
            ringColorMap.get(ringId) ||
            (score >= 70 ? "#ef4444" : score >= 40 ? "#f97316" : "#eab308");
        }

        return {
          id,
          name: id,
          suspicious: isSuspicious,
          suspicionScore: score,
          patterns: account?.detected_patterns || [],
          ringId,
          val: isSuspicious ? 2 + score / 25 : 1,
          color,
        };
      }
    );

    const linkAgg = new Map<
      string,
      { source: string; target: string; totalAmount: number; count: number }
    >();
    for (const edge of result.graph.edges) {
      const key = `${edge.source}||${edge.target}`;
      const existing = linkAgg.get(key);
      if (existing) {
        existing.totalAmount += edge.amount;
        existing.count++;
      } else {
        linkAgg.set(key, {
          source: edge.source,
          target: edge.target,
          totalAmount: edge.amount,
          count: 1,
        });
      }
    }

    const biDirectional = new Set<string>();
    for (const key of linkAgg.keys()) {
      const [s, t] = key.split("||");
      const reverseKey = `${t}||${s}`;
      if (linkAgg.has(reverseKey)) {
        biDirectional.add(key);
      }
    }

    const links: LinkObject[] = Array.from(linkAgg.values()).map((l) => {
      const key = `${l.source}||${l.target}`;
      const srcSus = suspiciousMap.has(l.source);
      const tgtSus = suspiciousMap.has(l.target);

      return {
        source: l.source,
        target: l.target,
        amount: l.totalAmount,
        color:
          srcSus && tgtSus
            ? "rgba(239, 68, 68, 0.4)"
            : "rgba(255, 255, 255, 0.08)",
        curvature: biDirectional.has(key) ? 0.3 : 0,
      };
    });

    console.log(
      `[Graph Viz] ${nodes.length} nodes, ${links.length} links (deduped from ${result.graph.edges.length} edges)`
    );
    return { nodes, links };
  }, [result, suspiciousMap, ringColorMap]);

  const handleRef = useCallback(
    (fg: any) => {
      if (!fg) return;
      fgRef.current = fg;

      if (!initDone.current) {
        initDone.current = true;

        const charge = fg.d3Force("charge");
        if (charge) charge.strength(-60).distanceMax(300);

        const link = fg.d3Force("link");
        if (link) link.distance(30);

        setTimeout(() => {
          fg.zoomToFit(400, 50);
        }, 1500);
      }
    },
    []
  );

  const handleNodeHover = useCallback(
    (node: NodeObject | null) => {
      setHoveredNode(node || null);
      if (containerRef.current) {
        containerRef.current.style.cursor = node ? "pointer" : "default";
      }
    },
    []
  );

  const handleNodeClick = useCallback(
    (node: any) => {
      setHoveredNode(node);
      if (fgRef.current && node) {
        fgRef.current.centerAt(node.x, node.y, 500);
        fgRef.current.zoom(3, 500);
      }
    },
    []
  );

  const nodeCanvasObject = useCallback(
    (
      node: NodeObject,
      ctx: CanvasRenderingContext2D,
      globalScale: number
    ) => {
      const x = node.x || 0;
      const y = node.y || 0;
      const size = node.suspicious ? 5 + node.suspicionScore / 25 : 3;

      if (node.suspicious) {
        ctx.shadowColor = node.color;
        ctx.shadowBlur = 15;
      }

      ctx.beginPath();
      ctx.arc(x, y, size, 0, 2 * Math.PI);
      ctx.fillStyle = node.color;
      ctx.fill();

      ctx.shadowBlur = 0;

      if (node.suspicious) {
        ctx.strokeStyle = "rgba(255,255,255,0.8)";
        ctx.lineWidth = 1.5 / globalScale;
        ctx.stroke();
      }

      const showLabel =
        (node.suspicious && globalScale > 0.6) || globalScale > 2.5;
      if (showLabel) {
        const fontSize = Math.max(10 / globalScale, 2);
        ctx.font = `bold ${fontSize}px Sans-Serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = node.suspicious ? "#fca5a5" : "#9ca3af";
        ctx.fillText(node.name, x, y + size + 2);
      }
    },
    []
  );

  const nodePointerAreaPaint = useCallback(
    (
      node: NodeObject,
      color: string,
      ctx: CanvasRenderingContext2D,
      _globalScale: number
    ) => {
      const size = node.suspicious ? 10 : 6;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(node.x || 0, node.y || 0, size, 0, 2 * Math.PI);
      ctx.fill();
    },
    []
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          <span>Transaction Network Graph</span>
          <div className="flex flex-wrap items-center gap-3 text-xs font-normal">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-gray-500" />
              Normal
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-yellow-500" />
              Low Risk
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-orange-500" />
              Medium
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500" />
              High Risk
            </span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          ref={containerRef}
          className="relative rounded-lg overflow-hidden"
          style={{ background: "radial-gradient(ellipse at center, #1a1a2e 0%, #0a0a0f 100%)" }}
        >
          {ForceGraph ? (
            <ForceGraph
              ref={handleRef}
              graphData={graphData}
              width={dimensions.width}
              height={dimensions.height}
              nodeCanvasObject={nodeCanvasObject}
              nodePointerAreaPaint={nodePointerAreaPaint}
              linkColor={(link: LinkObject) => link.color}
              linkWidth={0.4}
              linkCurvature={(link: LinkObject) => link.curvature}
              linkDirectionalArrowLength={3.5}
              linkDirectionalArrowRelPos={0.9}
              linkDirectionalArrowColor={(link: LinkObject) =>
                link.color.includes("239")
                  ? "rgba(239, 68, 68, 0.6)"
                  : "rgba(255, 255, 255, 0.2)"
              }
              linkDirectionalParticles={(link: LinkObject) =>
                link.color.includes("239") ? 3 : 0
              }
              linkDirectionalParticleWidth={2}
              linkDirectionalParticleSpeed={0.005}
              linkDirectionalParticleColor={() => "#ef4444"}
              backgroundColor="rgba(0,0,0,0)"
              onNodeHover={handleNodeHover}
              onNodeClick={handleNodeClick}
              enableNodeDrag={true}
              warmupTicks={100}
              cooldownTicks={300}
              d3VelocityDecay={0.3}
            />
          ) : (
            <div className="flex items-center justify-center h-[600px] text-muted-foreground">
              Loading graph...
            </div>
          )}

          {hoveredNode && (
            <div className="absolute top-4 right-4 bg-black/80 backdrop-blur-sm border border-white/10 rounded-lg p-4 shadow-2xl max-w-xs z-10">
              <p className="font-mono font-bold text-sm text-white">
                {hoveredNode.name}
              </p>
              {hoveredNode.suspicious ? (
                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">
                      Suspicion Score
                    </span>
                    <span
                      className="text-sm font-bold"
                      style={{ color: hoveredNode.color }}
                    >
                      {hoveredNode.suspicionScore}/100
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400">Patterns: </span>
                    <span className="text-xs text-gray-300">
                      {hoveredNode.patterns.join(", ")}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400">Ring: </span>
                    <span className="text-xs text-gray-300">
                      {hoveredNode.ringId}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-green-400 text-xs mt-1">
                  No suspicious activity detected
                </p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
