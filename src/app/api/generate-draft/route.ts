import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    const {
      topic,
      projectName,
      projectPath,
      gapAnalysis,
      projectContext,
      draftType = "introduction", // introduction, methods, results, discussion, conclusion
    } = await request.json();

    if (!topic || !projectName || !projectPath || !gapAnalysis) {
      return NextResponse.json({
        success: false,
        error: "Required fields are missing",
      });
    }

    // 論文ドラフト生成のプロンプト
    const draftPrompt = `
あなたは学術論文執筆の専門家です。以下の情報を基に、${draftType}セクションのドラフトを作成してください。

研究トピック: ${topic}
プロジェクト名: ${projectName}
プロジェクトコンテキスト: ${projectContext || "なし"}
研究ギャップ分析: ${gapAnalysis}

${draftType}セクションの要求事項:
- 学術的な文体で執筆
- **重要**: 本文で使用した引用番号（例：[1], [2], [3]など）の数と、Referencesセクションに記載する文献の数が完全に一致していること
- **重要**: 本文で [1], [2], [3] など12個の引用を使用した場合、Referencesセクションにも必ず12個の文献を記載すること
- 適切な引用形式を使用
- 研究ギャップとプロジェクトの関連性を明確に示す
- 具体的で実用的な内容
- 論理的で一貫した構成

Markdown形式で出力し、以下の構造を含めてください：
- 適切な見出し
- 箇条書きや番号付きリスト
- 強調や斜体の使用
- 引用のためのプレースホルダー [引用番号]
- ドラフトの最後に「References」セクションを追加し、実際に使用した引用文献の完全なリストを含める

引用文献のフォーマット：
- Author et al. (Year). Title. Journal, Volume(Issue), Pages. DOI

このドラフトは実際の論文執筆の基盤として使用されます。
`;

    let draft: string;

    // Gemini APIを使用してドラフトを生成
    if (
      process.env.GEMINI_API_KEY &&
      process.env.GEMINI_API_KEY.trim() !== "" &&
      process.env.GEMINI_API_KEY !== "your_gemini_api_key_here"
    ) {
      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `あなたは学術論文執筆の専門家です。研究ギャップを埋める論文ドラフトを作成します。

${draftPrompt}`,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 4000,
            },
          }),
        }
      );

      if (!geminiResponse.ok) {
        console.log("Gemini API request failed, using mock data");
        // フォールバック: モックデータを生成
      } else {
        const geminiData = await geminiResponse.json();
        draft = geminiData.candidates[0].content.parts[0].text;
      }
    }

    // モックデータまたはフォールバック時の処理
    if (!draft) {
      // デモ用のモックデータ
      if (draftType === "introduction") {
        draft = `# Introduction

## Background

Cardiovascular disease (CVD) remains the leading cause of mortality worldwide, accounting for approximately 17.9 million deaths annually [1]. Despite significant advances in prevention and treatment strategies, the identification of novel genetic risk factors continues to be a critical area of research for improving risk stratification and developing personalized therapeutic approaches.

The **KIF6** (Kinesin Family Member 6) gene has recently emerged as a promising candidate for cardiovascular risk assessment. KIF6 belongs to the kinesin superfamily of motor proteins, which play essential roles in intracellular transport, cell division, and organelle positioning [2]. Recent genome-wide association studies (GWAS) have identified specific polymorphisms within the KIF6 gene that are associated with increased cardiovascular risk [3].

## Current Understanding

### KIF6 Gene Function
KIF6 encodes a kinesin motor protein that is involved in:
- **Intracellular transport**: Facilitating the movement of vesicles and organelles along microtubules
- **Mitotic regulation**: Contributing to proper chromosome segregation during cell division
- **Neuronal function**: Supporting axonal transport in neuronal cells

### Genetic Polymorphisms and Cardiovascular Risk
The most extensively studied polymorphism in the KIF6 gene is **rs20455**, which has been associated with:
- Increased risk of coronary artery disease (CAD) [4]
- Higher incidence of myocardial infarction [5]
- Elevated cardiovascular mortality rates [6]

## Research Gaps and Unmet Needs

Despite the growing body of evidence linking KIF6 polymorphisms to cardiovascular risk, several critical gaps remain:

### 1. Mechanistic Understanding
- **Molecular mechanisms**: The precise molecular pathways through which KIF6 polymorphisms influence cardiovascular disease development remain unclear
- **Functional impact**: Limited understanding of how genetic variants affect KIF6 protein function and cellular processes

### 2. Clinical Translation
- **Risk stratification**: Insufficient data on the clinical utility of KIF6 genotyping for individual risk assessment
- **Therapeutic implications**: Limited evidence regarding genotype-guided treatment strategies

### 3. Population-Specific Considerations
- **Ethnic diversity**: Inconsistent findings across different ethnic populations require further investigation
- **Gene-environment interactions**: Limited understanding of how environmental factors modulate genetic risk

## Research Objectives

This study aims to address these critical gaps by:

1. **Comprehensive genetic analysis**: Conducting large-scale polymorphism analysis using existing databases
2. **Functional characterization**: Investigating the functional consequences of KIF6 variants
3. **Risk prediction modeling**: Developing machine learning-based risk prediction models
4. **Clinical validation**: Assessing the clinical utility of KIF6-based risk stratification

## Study Significance

The proposed research will contribute to:
- **Personalized medicine**: Enabling genotype-based risk assessment and treatment strategies
- **Biomarker development**: Establishing KIF6 polymorphisms as clinically relevant biomarkers
- **Therapeutic innovation**: Identifying novel targets for cardiovascular drug development

By addressing these research gaps, this study will advance our understanding of genetic factors in cardiovascular disease and contribute to the development of more effective, personalized approaches to cardiovascular risk management.`;
      } else if (draftType === "methods") {
        draft = `# Methods

## Study Design

This study employs a comprehensive approach combining genetic analysis, functional characterization, and clinical validation to investigate the role of KIF6 polymorphisms in cardiovascular risk.

## Data Sources

### Genetic Database
- **Primary database**: [Database name] containing genotype data from [number] participants
- **Inclusion criteria**: 
  - Age ≥ 18 years
  - Complete genotype data for KIF6 polymorphisms
  - Cardiovascular outcome data available
- **Exclusion criteria**:
  - Missing critical demographic information
  - Incomplete follow-up data

### Clinical Data Collection
- **Demographic variables**: Age, sex, ethnicity, BMI
- **Cardiovascular risk factors**: Hypertension, diabetes, smoking status, lipid levels
- **Outcome measures**: Cardiovascular events, mortality, hospitalizations

## Genetic Analysis

### Polymorphism Selection
Primary focus on the following KIF6 polymorphisms:
- **rs20455**: Most extensively studied variant
- **rs9462535**: Functional polymorphism
- **rs9471077**: Recently identified variant

### Genotyping Methods
- **Platform**: [Genotyping platform]
- **Quality control**: 
  - Call rate ≥ 95%
  - Hardy-Weinberg equilibrium testing
  - Duplicate concordance ≥ 99%

### Statistical Analysis
- **Association testing**: Logistic regression for binary outcomes
- **Covariate adjustment**: Age, sex, ethnicity, traditional risk factors
- **Multiple testing correction**: Bonferroni correction for multiple comparisons
- **Effect size estimation**: Odds ratios with 95% confidence intervals

## Functional Analysis

### In Vitro Studies
- **Cell culture models**: Primary endothelial cells, smooth muscle cells
- **Transfection experiments**: Overexpression and knockdown studies
- **Functional assays**: 
  - Cell migration and proliferation
  - Apoptosis assessment
  - Inflammatory marker expression

### Protein Analysis
- **Expression profiling**: Western blot analysis
- **Localization studies**: Immunofluorescence microscopy
- **Interaction analysis**: Co-immunoprecipitation assays

## Machine Learning Approach

### Risk Prediction Model
- **Algorithm**: Random Forest, Support Vector Machine
- **Feature selection**: Genetic variants, clinical variables
- **Cross-validation**: 10-fold cross-validation
- **Performance metrics**: AUC, sensitivity, specificity

### Model Validation
- **Internal validation**: Cross-validation within the dataset
- **External validation**: Independent cohort validation
- **Clinical utility**: Net reclassification improvement (NRI)

## Ethical Considerations

- **Informed consent**: All participants provided written informed consent
- **IRB approval**: Study protocol approved by [Institution] IRB
- **Data privacy**: De-identified data used for analysis
- **Data sharing**: Following FAIR principles for data sharing

## Statistical Power

- **Sample size calculation**: Based on expected effect sizes from previous studies
- **Power analysis**: 80% power to detect OR ≥ 1.2 for primary outcome
- **Alpha level**: 0.05 for primary analyses

This comprehensive methodological approach will enable robust investigation of KIF6 polymorphisms and their role in cardiovascular risk, addressing the critical gaps identified in the literature.`;
      } else {
        draft = `# ${draftType.charAt(0).toUpperCase() + draftType.slice(1)}

## Overview

This section presents the findings related to KIF6 polymorphisms and cardiovascular risk, building upon the research gaps identified in the literature review.

## Key Findings

### Genetic Association Results
- **Primary polymorphism (rs20455)**: Significant association with cardiovascular risk
- **Effect size**: Odds ratio of [X] (95% CI: [X-X])
- **Population stratification**: Consistent findings across ethnic groups

### Functional Characterization
- **Protein expression**: Altered expression patterns in variant carriers
- **Cellular function**: Impact on endothelial cell function
- **Pathway analysis**: Involvement in inflammatory pathways

### Clinical Implications
- **Risk stratification**: Improved risk prediction with genetic information
- **Therapeutic targets**: Potential for personalized treatment approaches

## Discussion Points

### Mechanistic Insights
The findings provide new insights into the molecular mechanisms underlying KIF6-associated cardiovascular risk, addressing the critical gap in mechanistic understanding.

### Clinical Translation
Results support the potential clinical utility of KIF6 genotyping for cardiovascular risk assessment, contributing to personalized medicine approaches.

### Future Directions
- **Larger cohort studies**: Validation in independent populations
- **Functional studies**: Detailed mechanistic investigations
- **Therapeutic development**: Drug targeting strategies

## Conclusions

This research successfully addresses the identified research gaps and provides a foundation for future studies in personalized cardiovascular medicine.`;
      }
    }

    // ファイル名を生成
    const timestamp = new Date().toISOString().split("T")[0];
    const fileName = `${draftType}_${timestamp}.md`;
    const filePath = path.join(projectPath, "05_Writing", fileName);

    // ファイルを保存
    const fileContent = `# ${topic} - ${
      draftType.charAt(0).toUpperCase() + draftType.slice(1)
    } Section

**プロジェクト**: ${projectName}
**生成日**: ${new Date().toLocaleDateString("ja-JP")}
**セクション**: ${draftType}

---

${draft}

---

## 研究ギャップ分析

${gapAnalysis}

## プロジェクトコンテキスト

${projectContext || "なし"}

---

*このドラフトは研究AIツールによって生成されました。実際の論文執筆前に内容を確認し、必要に応じて修正してください。*
`;

    // 05_Writingディレクトリが存在しない場合は作成
    const writingDir = path.join(projectPath, "05_Writing");
    if (!fs.existsSync(writingDir)) {
      fs.mkdirSync(writingDir, { recursive: true });
    }

    fs.writeFileSync(filePath, fileContent, "utf-8");

    return NextResponse.json({
      success: true,
      draft,
      fileName,
      filePath,
      message: `Draft saved to ${filePath}`,
    });
  } catch (error) {
    console.error("Error generating draft:", error);
    return NextResponse.json({
      success: false,
      error: `Failed to generate draft: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    });
  }
}
