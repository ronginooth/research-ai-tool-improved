"use client";

import { useEffect, useRef, useState } from "react";

interface CitationMapVisualizationProps {
  data: {
    center: any;
    citedBy: any[];
    references: any[];
    indirectConnections?: any[];
    networkMetrics?: any;
  };
  initialLibraryPapers?: Set<string>;
}

export default function CitationMapVisualization({
  data,
  initialLibraryPapers,
}: CitationMapVisualizationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragNodeId, setDragNodeId] = useState<string | null>(null);
  const [nodePositions, setNodePositions] = useState<{
    [key: string]: { x: number; y: number };
  }>({});
  const [nodes, setNodes] = useState<
    Array<{
      id: string;
      label: string;
      group: string;
      size: number;
      color: string;
    }>
  >([]);
  const [edges, setEdges] = useState<
    Array<{
      source: string;
      target: string;
      type: string;
      weight: number;
    }>
  >([]);
  const [selectedPaper, setSelectedPaper] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [savingToLibrary, setSavingToLibrary] = useState<string | null>(null);
  const [libraryPapers, setLibraryPapers] = useState<Set<string>>(
    initialLibraryPapers || new Set()
  );
  const [isSimulating, setIsSimulating] = useState(false);
  const [mapWidth, setMapWidth] = useState(800);
  const [detailsWidth, setDetailsWidth] = useState(320);
  const [listWidth, setListWidth] = useState(256);
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const resizeStartRef = useRef<{ x: number; mapWidth: number; detailsWidth: number; listWidth: number } | null>(null);
  const [viewMode, setViewMode] = useState<"citedBy" | "references" | "both">("citedBy");

  // 筆頭著者-年-ジャーナル表示のためのヘルパー関数
  const getFirstAuthorYear = (paper: any): string => {
    if (!paper) return "Unknown";

    // 著者情報の取得
    let firstAuthor = "Unknown";
    if (
      paper.authors &&
      Array.isArray(paper.authors) &&
      paper.authors.length > 0
    ) {
      const author = paper.authors[0];
      if (author && author.name && typeof author.name === "string") {
        // 姓（family name）を取得
        const nameParts = author.name.trim().split(/\s+/);
        if (nameParts.length >= 2) {
          // "T. Walton" や "John Smith" の場合、最後の部分が姓
          firstAuthor = nameParts[nameParts.length - 1];
        } else if (nameParts.length === 1) {
          // "Smith" のように姓のみの場合
          firstAuthor = nameParts[0];
        } else {
          // カンマ区切りの場合 "Smith, John" → "Smith"
          const commaParts = author.name.split(",");
          if (commaParts.length >= 2) {
            firstAuthor = commaParts[0].trim();
          } else {
            firstAuthor = author.name;
          }
        }
      }
    }

    // 年情報の取得
    const year = paper.year || new Date().getFullYear();

    // ジャーナル情報の取得と短縮
    let venue = "";
    if (paper.venue && typeof paper.venue === "string") {
      // ジャーナル名を短縮
      const venueMap: { [key: string]: string } = {
        Nature: "Nature",
        Science: "Science",
        Cell: "Cell",
        "Proceedings of the National Academy of Sciences": "PNAS",
        "PLOS ONE": "PLOS ONE",
        "PLOS Biology": "PLOS Biol.",
        "Journal of Cell Biology": "J.Cell.Biol.",
        "Journal of Biological Chemistry": "J.Biol.Chem.",
        "Nature Methods": "Nat.Methods",
        "Nature Biotechnology": "Nat.Biotechnol.",
        "Nature Communications": "Nat.Commun.",
        bioRxiv: "bioRxiv",
        arXiv: "arXiv",
      };

      venue = venueMap[paper.venue] || paper.venue;
      // 長すぎる場合は最初の部分のみ
      if (venue.length > 15) {
        venue = venue.substring(0, 15) + "...";
      }
    }

    // フォーマット: "Makino 2025"
    return `${firstAuthor} ${year}`;
  };

  // 論文の詳細情報を取得
  const getPaperDetails = (paper: any) => {
    if (!paper) return null;

    // authorsが配列でない場合は空配列にする
    const authors = Array.isArray(paper.authors) ? paper.authors : [];

    return {
      id: paper.id || paper.paperId,
      title: paper.title || "タイトルなし",
      authors: authors,
      year: paper.year || new Date().getFullYear(),
      venue: paper.venue || "ジャーナル不明",
      citationCount: paper.citationCount || 0,
      abstract: paper.abstract || "要約なし",
      url: paper.url || "",
      isOpenAccess: paper.isOpenAccess || false,
      source: paper.source || "unknown",
    };
  };

  // ライブラリに保存する関数
  const saveToLibrary = async (paper: any) => {
    if (!paper) return;

    const paperId = paper.id || paper.paperId;
    if (!paperId) {
      console.error("Paper ID is missing:", paper);
      alert("論文IDが取得できませんでした");
      return;
    }

    const paperIdString = String(paperId);
    if (savingToLibrary === paperIdString) return; // 既に保存中

    // 既にライブラリにある場合はスキップ
    if (libraryPapers.has(paperIdString)) {
      console.log(`Paper ${paperIdString} is already in library`);
      return;
    }

    setSavingToLibrary(paperIdString);

    try {
      // authorsの形式を確認（配列か文字列か）
      let authorsString = "";
      if (Array.isArray(paper.authors)) {
        authorsString = paper.authors.map((a: any) => (typeof a === "string" ? a : a.name || a)).join(", ");
      } else if (typeof paper.authors === "string") {
        authorsString = paper.authors;
      } else {
        authorsString = "著者不明";
      }

      const response = await fetch("/api/library", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: paperIdString,
          title: paper.title || "タイトルなし",
          authors: authorsString,
          year: paper.year || new Date().getFullYear(),
          venue: paper.venue || "ジャーナル不明",
          abstract: paper.abstract || "要約なし",
          url: paper.url || "",
          doi: paper.doi || "",
          citationCount: paper.citationCount || 0,
          isOpenAccess: paper.isOpenAccess || false,
          source: paper.source || "semantic_scholar",
        }),
      });

      if (response.ok) {
        const responseData = await response.json();
        // 保存成功時、libraryPapersに追加
        setLibraryPapers((prev) => {
          const newSet = new Set(prev);
          newSet.add(paperIdString);
          return newSet;
        });
        console.log(`Paper ${paperIdString} saved to library`);
        alert("ライブラリに保存しました！");
      } else {
        const errorData = await response.json().catch(() => ({ error: "不明なエラー" }));
        console.error("Failed to save paper to library:", errorData);
        
        // 「既に保存されています」というエラーの場合、libraryPapersに追加
        if (errorData.error && errorData.error.includes("既にライブラリに保存されています")) {
          setLibraryPapers((prev) => {
            const newSet = new Set(prev);
            newSet.add(paperIdString);
            return newSet;
          });
          console.log(`Paper ${paperIdString} is already in library, updating state`);
          alert("この論文は既にライブラリに保存されています");
        } else {
          alert(`ライブラリへの保存に失敗しました: ${errorData.error || "不明なエラー"}`);
        }
      }
    } catch (error) {
      console.error("Error saving paper to library:", error);
      alert(`ライブラリへの保存中にエラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`);
    } finally {
      setSavingToLibrary(null);
    }
  };

  // ライブラリから既存論文を取得（initialLibraryPapersがない場合のみ）
  useEffect(() => {
    if (initialLibraryPapers) {
      // 親から渡された場合はそれを使用
      setLibraryPapers(initialLibraryPapers);
      return;
    }

    const fetchLibraryPapers = async () => {
      try {
        const response = await fetch("/api/library?userId=demo-user-123");
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.papers) {
            // paper_id（Semantic Scholar ID）を取得
            // 注意: p.idはUUID、p.paper_idまたはp.paperIdがSemantic Scholar ID
            const paperIds = new Set<string>(
              data.papers
                .map((p: any) => {
                  // paper_idまたはpaperIdを優先（Semantic Scholar ID）
                  const semanticId = p.paper_id || p.paperId;
                  return semanticId ? String(semanticId) : null;
                })
                .filter(Boolean)
            );
            console.log("Fetched library papers (Semantic Scholar IDs):", Array.from(paperIds));
            console.log("Sample paper from library:", data.papers[0] ? {
              id: data.papers[0].id, // UUID
              paper_id: data.papers[0].paper_id, // Semantic Scholar ID
              paperId: data.papers[0].paperId, // マッピングされたSemantic Scholar ID
              title: data.papers[0].title?.substring(0, 50)
            } : "No papers");
            setLibraryPapers(paperIds);
          }
        }
      } catch (error) {
        console.error("Failed to fetch library papers:", error);
      }
    };

    fetchLibraryPapers();
  }, [initialLibraryPapers]);

  // データを変換してノードとエッジを作成
  useEffect(() => {
    if (!data) return;
    
    // デバッグ: ライブラリの状態と中心論文のIDを確認
    if (data.center) {
      const centerId = data.center.id || data.center.paperId;
      const centerIdString = String(centerId);
      console.log("Center paper ID check:", {
        centerId,
        centerIdString,
        centerIdType: typeof centerId,
        isInLibrary: libraryPapers.has(centerIdString),
        libraryPapersSize: libraryPapers.size,
        libraryPapersSample: Array.from(libraryPapers).slice(0, 3),
        libraryPapersHasCenterId: libraryPapers.has(centerId),
        libraryPapersHasCenterIdString: libraryPapers.has(centerIdString)
      });
    }
    
    // デバッグ: 引用された論文と参考文献のデータを確認
    console.log("Citation Map Data:", {
      viewMode,
      citedByCount: data.citedBy?.length || 0,
      referencesCount: data.references?.length || 0,
      citedByIsArray: Array.isArray(data.citedBy),
      referencesIsArray: Array.isArray(data.references),
      citedBySample: data.citedBy?.slice(0, 3).map((p: any) => ({
        id: p.id,
        paperId: p.paperId,
        title: p.title?.substring(0, 30)
      })) || [],
      referencesSample: data.references?.slice(0, 3).map((p: any) => ({
        id: p.id,
        paperId: p.paperId,
        title: p.title?.substring(0, 30)
      })) || []
    });
    
    // mapWidthを初期化（まだ設定されていない場合）
    if (mapWidth === 800) {
      // 初期値はそのまま
    }

    const newNodes: Array<{
      id: string;
      label: string;
      group: string;
      size: number;
      color: string;
    }> = [];
    const newEdges: Array<{
      source: string;
      target: string;
      type: string;
      weight: number;
    }> = [];

    // 中心ノードを追加
    if (data.center) {
      const centerId = data.center.id || data.center.paperId;
      const centerIdString = String(centerId);
      const isInLibrary = libraryPapers.has(centerIdString);
      newNodes.push({
        id: centerIdString,
        label: getFirstAuthorYear(data.center),
        group: "center",
        size: 8,
        color: isInLibrary ? "#10b981" : "#dc2626", // 中心論文: ライブラリ=緑、通常=赤
      });
    }

    // 引用された論文を追加（viewModeが"citedBy"または"both"の場合）
    if ((viewMode === "citedBy" || viewMode === "both") && data.citedBy && Array.isArray(data.citedBy)) {
      data.citedBy.forEach((paper: any, index: number) => {
        const paperId = paper.id || paper.paperId;
        if (paper && paperId) {
          const paperIdString = String(paperId);
          const isInLibrary = libraryPapers.has(paperIdString);
          newNodes.push({
            id: paperIdString,
            label: getFirstAuthorYear(paper),
            group: "citedBy",
            size: 6,
            color: isInLibrary ? "#10b981" : "#2563eb", // 引用論文: ライブラリ=緑、通常=青
          });
          // 中心論文から引用論文へのエッジ
          if (data.center) {
            const centerId = data.center.id || data.center.paperId;
            newEdges.push({
              source: String(centerId),
              target: paperIdString,
              type: "citation",
              weight: 1,
            });
          }
        }
      });
    }

    // 参考文献を追加（viewModeが"references"または"both"の場合）
    if ((viewMode === "references" || viewMode === "both") && data.references && Array.isArray(data.references)) {
      console.log(`Adding references nodes: viewMode=${viewMode}, references count=${data.references.length}`);
      let addedCount = 0;
      data.references.forEach((paper: any, index: number) => {
        const paperId = paper.id || paper.paperId;
        if (paper && paperId) {
          const paperIdString = String(paperId);
          const isInLibrary = libraryPapers.has(paperIdString);
          newNodes.push({
            id: paperIdString,
            label: getFirstAuthorYear(paper),
            group: "references",
            size: 5,
            color: isInLibrary ? "#10b981" : "#7c3aed", // 参考文献: ライブラリ=緑、通常=紫
          });
          addedCount++;
          // 参考文献から中心論文へのエッジ
          if (data.center) {
            const centerId = data.center.id || data.center.paperId;
            newEdges.push({
              source: paperIdString,
              target: String(centerId),
              type: "reference",
              weight: 1,
            });
          }
        } else {
          console.warn(`Reference paper at index ${index} is missing ID:`, paper);
        }
      });
      console.log(`Added ${addedCount} reference nodes to the map`);
    } else {
      console.log(`Skipping references: viewMode=${viewMode}, hasReferences=${!!data.references}, isArray=${Array.isArray(data.references)}`);
    }

    console.log(`Final nodes count: ${newNodes.length}, edges count: ${newEdges.length}`);
    console.log(`Nodes by group:`, {
      center: newNodes.filter(n => n.group === "center").length,
      citedBy: newNodes.filter(n => n.group === "citedBy").length,
      references: newNodes.filter(n => n.group === "references").length
    });
    
    setNodes(newNodes);
    setEdges(newEdges);

    // 初期位置を計算（改善された配置アルゴリズム）
    const centerX = 400;
    const centerY = 300;
    const baseRadius = 150;
    const initialPositions: { [key: string]: { x: number; y: number } } = {};

    // 中心ノードを配置
    const centerNode = newNodes.find((node) => node.group === "center");
    if (centerNode) {
      initialPositions[centerNode.id] = { x: centerX, y: centerY };
    }

    // 他のノードをグループ別に配置
    const otherNodes = newNodes.filter((node) => node.group !== "center");
    const citedByNodes = otherNodes.filter((node) => node.group === "citedBy");
    const referenceNodes = otherNodes.filter(
      (node) => node.group === "references"
    );

    // 引用された論文を配置（内側の円、より密に）
    citedByNodes.forEach((node, index) => {
      const angle = (2 * Math.PI * index) / Math.max(citedByNodes.length, 1);
      const radius = baseRadius * 0.5; // 内側の円
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      initialPositions[node.id] = { x, y };
    });

    // 参考文献を配置（外側の円、より広く）
    console.log(`Positioning reference nodes: count=${referenceNodes.length}, viewMode=${viewMode}`);
    referenceNodes.forEach((node, index) => {
      const angle = (2 * Math.PI * index) / Math.max(referenceNodes.length, 1);
      const radius = baseRadius * 1.2; // 外側の円
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      initialPositions[node.id] = { x, y };
      console.log(`Reference node ${index}: id=${node.id}, position=(${x}, ${y})`);
    });
    console.log(`Total positions after positioning: ${Object.keys(initialPositions).length}, referenceNodes: ${referenceNodes.length}`);

    // 文字の重なりを防ぐための微調整
    const adjustPositions = (positions: {
      [key: string]: { x: number; y: number };
    }) => {
      const adjusted = { ...positions };
      const minDistance = 80; // 最小距離

      Object.keys(adjusted).forEach((id1) => {
        Object.keys(adjusted).forEach((id2) => {
          if (id1 !== id2) {
            const pos1 = adjusted[id1];
            const pos2 = adjusted[id2];
            const distance = Math.sqrt(
              Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.y - pos2.y, 2)
            );

            if (distance < minDistance) {
              // 距離が近すぎる場合は調整
              const angle = Math.atan2(pos1.y - pos2.y, pos1.x - pos2.x);
              const newX = pos2.x + minDistance * Math.cos(angle);
              const newY = pos2.y + minDistance * Math.sin(angle);
              adjusted[id1] = { x: newX, y: newY };
            }
          }
        });
      });

      return adjusted;
    };

    const finalPositions = adjustPositions(initialPositions);
    setNodePositions(finalPositions);
  }, [data, mapWidth, viewMode, libraryPapers]);

  // 斥力シミュレーション
  useEffect(() => {
    if (!isSimulating || nodes.length === 0) return;

    const simulation = () => {
      const newPositions = { ...nodePositions };
      const repulsionStrength = 1000; // 斥力の強さ
      const minDistance = 80; // 最小距離
      const damping = 0.8; // 減衰係数

      // 各ノードに斥力を適用
      Object.keys(newPositions).forEach((nodeId1) => {
        let forceX = 0;
        let forceY = 0;

        Object.keys(newPositions).forEach((nodeId2) => {
          if (nodeId1 !== nodeId2) {
            const pos1 = newPositions[nodeId1];
            const pos2 = newPositions[nodeId2];
            const dx = pos1.x - pos2.x;
            const dy = pos1.y - pos2.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > 0 && distance < minDistance * 2) {
              // 斥力を計算
              const force = repulsionStrength / (distance * distance);
              forceX += (dx / distance) * force;
              forceY += (dy / distance) * force;
            }
          }
        });

        // 位置を更新
        newPositions[nodeId1] = {
          x: Math.max(
            30,
            Math.min(mapWidth - 30, newPositions[nodeId1].x + forceX * damping)
          ),
          y: Math.max(
            30,
            Math.min(570, newPositions[nodeId1].y + forceY * damping)
          ),
        };
      });

      setNodePositions(newPositions);
    };

    const interval = setInterval(simulation, 50); // 50ms間隔でシミュレーション
    return () => clearInterval(interval);
  }, [isSimulating, nodes.length, nodePositions]);

  // SVGを描画
  useEffect(() => {
    if (!containerRef.current || nodes.length === 0) return;

    // コンテナをクリア
    containerRef.current.innerHTML = "";

    // 簡単なSVGベースのネットワーク図を生成
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "600");
    svg.setAttribute("viewBox", `0 0 ${mapWidth} 600`);
    svg.style.border = "1px solid #e2e8f0";
    svg.style.borderRadius = "8px";
    svg.style.backgroundColor = "#f8fafc";
    svg.style.cursor = isDragging ? "grabbing" : "grab";

    // エッジを描画
    edges.forEach((edge) => {
      const sourcePos = nodePositions[edge.source];
      const targetPos = nodePositions[edge.target];

      if (sourcePos && targetPos) {
        const line = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "line"
        );
        line.setAttribute("x1", sourcePos.x.toString());
        line.setAttribute("y1", sourcePos.y.toString());
        line.setAttribute("x2", targetPos.x.toString());
        line.setAttribute("y2", targetPos.y.toString());
        line.setAttribute(
          "stroke",
          edge.type === "citation" ? "#4ecdc4" : "#45b7d1"
        );
        line.setAttribute("stroke-width", "2");
        line.setAttribute("opacity", "0.6");
        svg.appendChild(line);
      }
    });

    // ノードを描画
    nodes.forEach((node) => {
      const pos = nodePositions[node.id];
      if (pos) {
        // ノードグループを作成
        const nodeGroup = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "g"
        );
        nodeGroup.setAttribute("class", `node-${node.id}`);
        nodeGroup.style.cursor = "grab";

        // ノードの円
        const circle = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "circle"
        );
        circle.setAttribute("cx", pos.x.toString());
        circle.setAttribute("cy", pos.y.toString());
        circle.setAttribute("r", node.size.toString());
        circle.setAttribute("fill", node.color);
        circle.setAttribute("stroke", "#ffffff");
        circle.setAttribute("stroke-width", "2");
        circle.setAttribute("class", "node-circle");
        nodeGroup.appendChild(circle);

        // ノードのラベル（文字の重なりを防ぐため位置を調整）
        const text = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "text"
        );
        text.setAttribute("x", pos.x.toString());
        text.setAttribute("y", (pos.y + node.size + 15).toString());
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("font-size", "9");
        text.setAttribute("fill", "#374151");
        text.setAttribute("class", "node-label");
        // ライブラリ内の論文には✓マークを追加
        const labelText = libraryPapers.has(node.id) 
          ? `✓ ${node.label.length > 23 ? node.label.substring(0, 23) + "..." : node.label}`
          : (node.label.length > 25 ? node.label.substring(0, 25) + "..." : node.label);
        text.textContent = labelText;
        nodeGroup.appendChild(text);

        // ドラッグイベントを追加
        nodeGroup.addEventListener("mousedown", (e) => {
          e.preventDefault();
          setIsDragging(true);
          setDragNodeId(node.id);
        });

        // クリックイベントを追加（論文選択）
        nodeGroup.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();

          // 対応する論文データを取得
          let paperData = null;
          if (node.group === "center") {
            paperData = data.center;
          } else if (node.group === "citedBy") {
            paperData = data.citedBy?.find((p: any) => p.id === node.id);
          } else if (node.group === "references") {
            paperData = data.references?.find((p: any) => p.id === node.id);
          }

          if (paperData) {
            setSelectedPaper(getPaperDetails(paperData));
            setShowDetails(true);
          }
        });

        svg.appendChild(nodeGroup);
      }
    });

    // 凡例を追加
    const legend = document.createElementNS("http://www.w3.org/2000/svg", "g");

    // 中心論文
    const centerLegend = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "g"
    );
    const centerCircle = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle"
    );
    centerCircle.setAttribute("cx", "50");
    centerCircle.setAttribute("cy", "50");
    centerCircle.setAttribute("r", "6");
    centerCircle.setAttribute("fill", "#dc2626");
    centerLegend.appendChild(centerCircle);

    const centerText = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "text"
    );
    centerText.setAttribute("x", "70");
    centerText.setAttribute("y", "55");
    centerText.setAttribute("font-size", "12");
    centerText.setAttribute("fill", "#374151");
    centerText.textContent = "中心論文";
    centerLegend.appendChild(centerText);
    legend.appendChild(centerLegend);

    // 引用された論文
    const citedLegend = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "g"
    );
    const citedCircle = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle"
    );
    citedCircle.setAttribute("cx", "50");
    citedCircle.setAttribute("cy", "80");
    citedCircle.setAttribute("r", "6");
    citedCircle.setAttribute("fill", "#2563eb");
    citedLegend.appendChild(citedCircle);

    const citedText = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "text"
    );
    citedText.setAttribute("x", "70");
    citedText.setAttribute("y", "85");
    citedText.setAttribute("font-size", "12");
    citedText.setAttribute("fill", "#374151");
    citedText.textContent = "引用された論文";
    citedLegend.appendChild(citedText);
    legend.appendChild(citedLegend);

    // 参考文献
    const refLegend = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "g"
    );
    const refCircle = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle"
    );
    refCircle.setAttribute("cx", "50");
    refCircle.setAttribute("cy", "110");
    refCircle.setAttribute("r", "6");
    refCircle.setAttribute("fill", "#7c3aed");
    refLegend.appendChild(refCircle);

    const refText = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "text"
    );
    refText.setAttribute("x", "70");
    refText.setAttribute("y", "115");
    refText.setAttribute("font-size", "12");
    refText.setAttribute("fill", "#374151");
    refText.textContent = "参考文献";
    refLegend.appendChild(refText);
    legend.appendChild(refLegend);

    // ライブラリ保存済み
    const libLegend = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "g"
    );
    const libCircle = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle"
    );
    libCircle.setAttribute("cx", "50");
    libCircle.setAttribute("cy", "140");
    libCircle.setAttribute("r", "6");
    libCircle.setAttribute("fill", "#10b981");
    libLegend.appendChild(libCircle);

    const libText = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "text"
    );
    libText.setAttribute("x", "70");
    libText.setAttribute("y", "145");
    libText.setAttribute("font-size", "12");
    libText.setAttribute("fill", "#374151");
    libText.textContent = "ライブラリ保存済み";
    libLegend.appendChild(libText);
    legend.appendChild(libLegend);

    svg.appendChild(legend);
    containerRef.current.appendChild(svg);

    // ドラッグイベントリスナーを追加
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !dragNodeId) return;

      const rect = svg.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (mapWidth / rect.width);
      const y = (e.clientY - rect.top) * (600 / rect.height);

      // ドラッグ中のノードの位置を更新
      const newPositions = { ...nodePositions };
      newPositions[dragNodeId] = { x, y };

      // 他のノードとの衝突を避ける
      const minDistance = 60; // 最小距離
      Object.keys(newPositions).forEach((nodeId) => {
        if (nodeId !== dragNodeId) {
          const pos1 = newPositions[dragNodeId];
          const pos2 = newPositions[nodeId];
          const distance = Math.sqrt(
            Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.y - pos2.y, 2)
          );

          if (distance < minDistance) {
            // 距離が近すぎる場合は他のノードを押し出す
            const angle = Math.atan2(pos2.y - pos1.y, pos2.x - pos1.x);
            const newX = pos1.x + minDistance * Math.cos(angle);
            const newY = pos1.y + minDistance * Math.sin(angle);

            // 画面内に収まるように調整
            const clampedX = Math.max(30, Math.min(770, newX));
            const clampedY = Math.max(30, Math.min(570, newY));

            newPositions[nodeId] = { x: clampedX, y: clampedY };
          }
        }
      });

      setNodePositions(newPositions);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setDragNodeId(null);
    };

    svg.addEventListener("mousemove", handleMouseMove);
    svg.addEventListener("mouseup", handleMouseUp);
    svg.addEventListener("mouseleave", handleMouseUp);

    return () => {
      svg.removeEventListener("mousemove", handleMouseMove);
      svg.removeEventListener("mouseup", handleMouseUp);
      svg.removeEventListener("mouseleave", handleMouseUp);
    };
  }, [nodes, edges, nodePositions, isDragging, dragNodeId]);

  // リサイズハンドラー
  const handleMouseDown = (side: 'right' | 'left', e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(side);
    resizeStartRef.current = {
      x: e.clientX,
      mapWidth,
      detailsWidth,
      listWidth,
    };
  };

  useEffect(() => {
    if (!isResizing || !resizeStartRef.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeStartRef.current!.x;

      if (isResizing === 'right' && resizeStartRef.current) {
        // 詳細パネルとmapエリアの境界をリサイズ
        const newDetailsWidth = Math.max(200, Math.min(600, resizeStartRef.current.detailsWidth - deltaX));
        const newMapWidth = Math.max(400, resizeStartRef.current.mapWidth + deltaX);
        setDetailsWidth(newDetailsWidth);
        setMapWidth(newMapWidth);
      } else if (isResizing === 'left' && resizeStartRef.current) {
        // 論文一覧パネルとmapエリアの境界をリサイズ
        const newListWidth = Math.max(200, Math.min(500, resizeStartRef.current.listWidth + deltaX));
        const newMapWidth = Math.max(400, resizeStartRef.current.mapWidth - deltaX);
        setListWidth(newListWidth);
        setMapWidth(newMapWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(null);
      resizeStartRef.current = null;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, mapWidth, detailsWidth, listWidth]);

  return (
    <div className="w-full overflow-x-auto overflow-y-hidden">
      <div 
        className="flex gap-4" 
        style={{ 
          minWidth: `${mapWidth + (showDetails ? detailsWidth + 4 : 0) + listWidth + 32}px`,
          width: 'max-content'
        }}
      >
        {/* メインネットワーク図 */}
        <div 
          className="flex-shrink-0" 
          style={{ 
            minWidth: `${mapWidth}px`,
            width: `${mapWidth}px`
          }}
        >
          <div className="mb-4 text-sm text-slate-600">
            💡 ノードをドラッグして移動できます。クリックで詳細を表示します。
          </div>
          
          {/* 表示モード切り替えメニュー */}
          <div className="mb-4 flex items-center gap-4">
            <div className="flex gap-2 bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode("citedBy")}
                className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                  viewMode === "citedBy"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                引用された論文 ({data.citedBy?.length || 0})
              </button>
              <button
                onClick={() => setViewMode("references")}
                className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                  viewMode === "references"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                参考文献 ({data.references?.length || 0})
              </button>
              <button
                onClick={() => setViewMode("both")}
                className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                  viewMode === "both"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                両方表示
              </button>
            </div>
            
            <button
              onClick={() => setIsSimulating(!isSimulating)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                isSimulating
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              {isSimulating ? "斥力停止" : "斥力開始"}
            </button>
            {isSimulating && (
              <span className="px-3 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg">
                ノード間の斥力が働いています
              </span>
            )}
          </div>
          <div ref={containerRef} className="w-full" style={{ minWidth: `${mapWidth}px` }} />
        </div>

        {/* リサイズハンドル（詳細パネルとmapエリアの間） */}
        {showDetails && (
          <div
            className="flex-shrink-0 w-1 bg-slate-200 hover:bg-slate-400 cursor-col-resize transition-colors"
            onMouseDown={(e) => handleMouseDown('right', e)}
          />
        )}

        {/* 詳細パネル */}
        {showDetails && (
          <div 
            className="flex-shrink-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm overflow-y-auto"
            style={{ 
              width: `${detailsWidth}px`,
              maxHeight: '600px'
            }}
          >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">論文詳細</h3>
            <button
              onClick={() => setShowDetails(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          </div>

          {selectedPaper && (
            <div className="space-y-4">
              {/* タイトル */}
              <div>
                <h4 className="text-sm font-semibold text-slate-700">
                  タイトル
                </h4>
                <p className="text-sm text-slate-600">{selectedPaper.title}</p>
              </div>

              {/* 著者 */}
              <div>
                <h4 className="text-sm font-semibold text-slate-700">著者</h4>
                <p className="text-sm text-slate-600">
                  {selectedPaper.authors
                    .map((author: any) => author.name)
                    .join(", ")}
                </p>
              </div>

              {/* 年・ジャーナル */}
              <div className="flex gap-4">
                <div>
                  <h4 className="text-sm font-semibold text-slate-700">年</h4>
                  <p className="text-sm text-slate-600">{selectedPaper.year}</p>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-700">
                    ジャーナル
                  </h4>
                  <p className="text-sm text-slate-600">
                    {selectedPaper.venue}
                  </p>
                </div>
              </div>

              {/* 引用数・オープンアクセス */}
              <div className="flex gap-4">
                <div>
                  <h4 className="text-sm font-semibold text-slate-700">
                    引用数
                  </h4>
                  <p className="text-sm text-slate-600">
                    {selectedPaper.citationCount}
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-700">
                    オープンアクセス
                  </h4>
                  <p className="text-sm text-slate-600">
                    {selectedPaper.isOpenAccess ? "✅" : "❌"}
                  </p>
                </div>
              </div>

              {/* 要約 */}
              <div>
                <h4 className="text-sm font-semibold text-slate-700">要約</h4>
                <p className="text-xs text-slate-600 line-clamp-4">
                  {selectedPaper.abstract}
                </p>
              </div>

              {/* リンク */}
              {selectedPaper.url && (
                <div>
                  <a
                    href={selectedPaper.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    Semantic Scholar で開く →
                  </a>
                </div>
              )}

              {/* ライブラリ保存ボタン */}
              <div className="mt-4">
                {libraryPapers.has(String(selectedPaper.id)) ? (
                  <div className="rounded-lg bg-green-50 border border-green-200 p-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-green-700">
                      <span className="text-green-600 font-bold">✓</span>
                      <span>ライブラリに保存済み</span>
                    </div>
                    <button
                      onClick={() => {
                        window.location.href = `/library?paperId=${selectedPaper.id}`;
                      }}
                      className="mt-2 w-full rounded-lg bg-green-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-green-700"
                    >
                      ライブラリで詳細を表示
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      // 元の論文データを取得
                      let originalPaper = null;
                      const selectedId = String(selectedPaper.id);
                      
                      // 中心論文をチェック
                      if (data.center) {
                        const centerId = String(data.center.id || data.center.paperId);
                        if (selectedId === centerId) {
                          originalPaper = data.center;
                        }
                      }
                      
                      // 引用された論文をチェック
                      if (!originalPaper && data.citedBy && Array.isArray(data.citedBy)) {
                        originalPaper = data.citedBy.find(
                          (p: any) => String(p.id || p.paperId) === selectedId
                        );
                      }
                      
                      // 参考文献をチェック
                      if (!originalPaper && data.references && Array.isArray(data.references)) {
                        originalPaper = data.references.find(
                          (p: any) => String(p.id || p.paperId) === selectedId
                        );
                      }

                      if (originalPaper) {
                        saveToLibrary(originalPaper);
                      } else {
                        console.error("Original paper not found for selectedPaper:", selectedPaper);
                        alert("論文データが見つかりませんでした。");
                      }
                    }}
                    disabled={savingToLibrary === String(selectedPaper.id)}
                    className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                  >
                    {savingToLibrary === String(selectedPaper.id)
                      ? "保存中..."
                      : "ライブラリに保存"}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* リサイズハンドル（論文一覧パネルとmapエリアの間） */}
      <div
        className="flex-shrink-0 w-1 bg-slate-200 hover:bg-slate-400 cursor-col-resize transition-colors"
        onMouseDown={(e) => handleMouseDown('left', e)}
      />

      {/* 論文一覧パネル */}
      <div 
        className="flex-shrink-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm overflow-y-auto"
        style={{ 
          width: `${listWidth}px`,
          maxHeight: '600px'
        }}
      >
        <h3 className="mb-4 text-lg font-semibold text-slate-900">論文一覧</h3>

        <div className="space-y-3">
          {/* 中心論文 */}
          {data.center && (() => {
            const centerId = data.center.id || data.center.paperId;
            const centerIdString = String(centerId);
            const isInLibrary = libraryPapers.has(centerIdString);
            const isSelected =
              selectedPaper && (selectedPaper.id === centerId || selectedPaper.id === data.center.paperId);
            return (
              <div
                className={`cursor-pointer rounded-lg p-3 transition border ${
                  isSelected 
                    ? "bg-green-100 border-green-300" 
                    : isInLibrary
                    ? "bg-green-50 border-green-200 hover:bg-green-100"
                    : "bg-green-50 border-green-100 hover:bg-green-100"
                }`}
                onClick={() => {
                  if (isInLibrary) {
                    // ライブラリ詳細画面に遷移
                    window.location.href = `/library?paperId=${centerIdString}`;
                  } else {
                    setSelectedPaper(getPaperDetails(data.center));
                    setShowDetails(true);
                  }
                }}
              >
                <div className="text-xs font-semibold text-green-800 flex items-center gap-1">
                  {isInLibrary && <span className="text-green-600 font-bold">✓</span>}
                  中心論文
                  {isInLibrary && <span className="text-xs text-green-600">(保存済み)</span>}
                </div>
                <div className="text-sm text-green-700">
                  {getFirstAuthorYear(data.center)}
                </div>
                <div className="text-xs text-green-600">
                  {data.center.title?.substring(0, 50)}...
                </div>
                {isInLibrary && (
                  <div className="mt-1 text-xs text-green-600 font-medium">
                    ✓ ライブラリに保存済み - クリックでライブラリ詳細を表示
                  </div>
                )}
              </div>
            );
          })()}

          {/* 引用された論文 */}
          {(viewMode === "citedBy" || viewMode === "both") && data.citedBy && Array.isArray(data.citedBy) && data.citedBy.length > 0 && (
            <div>
              <div className="mb-2 text-xs font-semibold text-slate-700">
                引用された論文 ({data.citedBy.length})
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {data.citedBy.slice(0, 10).map((paper: any, index: number) => {
                  if (!paper) return null;
                  const paperId = paper.id || paper.paperId;
                  if (!paperId) {
                    console.warn("CitedBy paper missing ID:", paper);
                    return null;
                  }
                  const paperIdString = String(paperId);
                  const isInLibrary = libraryPapers.has(paperIdString);
                  const isSelected =
                    selectedPaper && (selectedPaper.id === paper.id || selectedPaper.id === paper.paperId);
                  return (
                    <div
                      key={paper.id || paper.paperId || index}
                      className={`cursor-pointer rounded p-2 text-xs transition ${
                        isSelected 
                          ? "bg-blue-100 border border-blue-300" 
                          : isInLibrary
                          ? "bg-green-50 border border-green-200 hover:bg-green-100"
                          : "hover:bg-slate-50"
                      }`}
                      onClick={() => {
                        const paperId = paper.id || paper.paperId;
                        if (!paperId) return;
                        const paperIdString = String(paperId);
                        const isInLibrary = libraryPapers.has(paperIdString);
                        if (isInLibrary) {
                          // ライブラリ詳細画面に遷移
                          window.location.href = `/library?paperId=${paperIdString}`;
                        } else {
                          setSelectedPaper(getPaperDetails(paper));
                          setShowDetails(true);
                        }
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className={`font-medium flex items-center gap-1 ${
                            isInLibrary ? "text-green-700" : "text-slate-700"
                          }`}>
                            {isInLibrary && <span className="text-green-600">✓</span>}
                            {getFirstAuthorYear(paper)}
                          </div>
                          <div className={`text-xs ${
                            isInLibrary ? "text-green-600" : "text-slate-500"
                          }`}>
                            {paper.title?.substring(0, 40)}...
                          </div>
                          {isInLibrary && (
                            <div className="text-xs text-green-600 mt-1">
                              ライブラリに保存済み
                            </div>
                          )}
                        </div>
                        <div className="ml-2">
                          {isInLibrary ? (
                            <span
                              className="text-green-600 font-bold"
                              title="ライブラリに保存済み - クリックでライブラリ詳細を表示"
                            >
                              ✓
                            </span>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                saveToLibrary(paper);
                              }}
                              disabled={savingToLibrary === String(paper.id || paper.paperId)}
                              className="text-blue-600 hover:text-blue-800 disabled:text-gray-400"
                            >
                              {savingToLibrary === String(paper.id || paper.paperId) ? "..." : "+"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {data.citedBy.length > 10 && (
                  <div className="text-xs text-slate-500">
                    ...他 {data.citedBy.length - 10} 件
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 参考文献 */}
          {(viewMode === "references" || viewMode === "both") && data.references && Array.isArray(data.references) && data.references.length > 0 && (
            <div>
              <div className="mb-2 text-xs font-semibold text-slate-700">
                参考文献 ({data.references.length})
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {data.references
                  .slice(0, 10)
                  .map((paper: any, index: number) => {
                    if (!paper) return null;
                    const paperId = paper.id || paper.paperId;
                    if (!paperId) {
                      console.warn("Reference paper missing ID:", paper);
                      return null;
                    }
                    const paperIdString = String(paperId);
                    const isInLibrary = libraryPapers.has(paperIdString);
                    const isSelected =
                      selectedPaper && (selectedPaper.id === paper.id || selectedPaper.id === paper.paperId);
                    return (
                      <div
                        key={paper.id || paper.paperId || index}
                        className={`cursor-pointer rounded p-2 text-xs transition ${
                          isSelected 
                            ? "bg-blue-100 border border-blue-300" 
                            : isInLibrary
                            ? "bg-green-50 border border-green-200 hover:bg-green-100"
                            : "hover:bg-slate-50"
                        }`}
                        onClick={() => {
                          const paperId = paper.id || paper.paperId;
                          if (!paperId) return;
                          const paperIdString = String(paperId);
                          const isInLibrary = libraryPapers.has(paperIdString);
                          if (isInLibrary) {
                            // ライブラリ詳細画面に遷移
                            window.location.href = `/library?paperId=${paperIdString}`;
                          } else {
                            setSelectedPaper(getPaperDetails(paper));
                            setShowDetails(true);
                          }
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className={`font-medium flex items-center gap-1 ${
                              isInLibrary ? "text-green-700" : "text-slate-700"
                            }`}>
                              {isInLibrary && <span className="text-green-600">✓</span>}
                              {getFirstAuthorYear(paper)}
                            </div>
                            <div className={`text-xs ${
                              isInLibrary ? "text-green-600" : "text-slate-500"
                            }`}>
                              {paper.title?.substring(0, 40)}...
                            </div>
                            {isInLibrary && (
                              <div className="text-xs text-green-600 mt-1">
                                ライブラリに保存済み
                              </div>
                            )}
                          </div>
                          <div className="ml-2">
                            {isInLibrary ? (
                              <span
                                className="text-green-600 font-bold"
                                title="ライブラリに保存済み - クリックでライブラリ詳細を表示"
                              >
                                ✓
                              </span>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  saveToLibrary(paper);
                                }}
                                disabled={savingToLibrary === String(paper.id || paper.paperId)}
                                className="text-blue-600 hover:text-blue-800 disabled:text-gray-400"
                              >
                                {savingToLibrary === String(paper.id || paper.paperId) ? "..." : "+"}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                {data.references.length > 10 && (
                  <div className="text-xs text-slate-500">
                    ...他 {data.references.length - 10} 件
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </div>
  );
}
