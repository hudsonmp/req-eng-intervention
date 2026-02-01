import { VersionService } from './version-service.js';
import { ComponentService } from './component-service.js';
import { RunService } from './run-service.js';
import { AnalysisResult, Component, PromptVersion } from '../types.js';

export class AnalysisService {
  constructor(
    private versionService: VersionService,
    private componentService: ComponentService,
    private runService: RunService
  ) {}

  async analyzeVersion(versionId: string): Promise<AnalysisResult> {
    const version = await this.versionService.getById(versionId);
    if (!version) {
      throw new Error(`Version ${versionId} not found`);
    }

    let components = await this.componentService.getByVersionId(versionId);

    // Parse components if not already parsed
    if (components.length === 0) {
      components = await this.componentService.parsePromptIntoComponents(
        versionId,
        version.prompt_content
      );
    }

    const structural_issues = this.identifyStructuralIssues(components);
    const ambiguities = this.identifyAmbiguities(version.prompt_content, components);
    const implicit_assumptions = this.identifyImplicitAssumptions(
      version.prompt_content,
      components
    );
    const provider_sensitivities = this.identifyProviderSensitivities(
      version.prompt_content,
      components
    );
    const improvement_suggestions = this.generateImprovementSuggestions(
      structural_issues,
      ambiguities,
      implicit_assumptions
    );

    return {
      version_id: versionId,
      components,
      structural_issues,
      ambiguities,
      implicit_assumptions,
      provider_sensitivities,
      improvement_suggestions,
    };
  }

  private identifyStructuralIssues(components: Component[]): string[] {
    const issues: string[] = [];

    // Check for missing critical components
    const types = new Set(components.map((c) => c.component_type));

    if (!types.has('instruction') && !types.has('context')) {
      issues.push('No instruction or context section detected. Prompt may lack clear direction.');
    }

    if (!types.has('output_format')) {
      issues.push(
        'No explicit output format specification. Model behavior may be unpredictable.'
      );
    }

    // Check for component dependencies
    for (const component of components) {
      if (component.dependencies.length > 0) {
        const missingDeps = component.dependencies.filter(
          (depId) => !components.some((c) => c.id === depId)
        );
        if (missingDeps.length > 0) {
          issues.push(
            `Component at position ${component.position} references non-existent dependencies.`
          );
        }
      }
    }

    // Check for redundancy
    const contentMap = new Map<string, Component[]>();
    for (const component of components) {
      const normalized = component.content.trim().toLowerCase();
      if (!contentMap.has(normalized)) {
        contentMap.set(normalized, []);
      }
      contentMap.get(normalized)!.push(component);
    }

    for (const [content, comps] of contentMap) {
      if (comps.length > 1) {
        issues.push(
          `Duplicate or near-duplicate content detected across positions: ${comps.map((c) => c.position).join(', ')}`
        );
      }
    }

    return issues;
  }

  private identifyAmbiguities(promptContent: string, components: Component[]): string[] {
    const ambiguities: string[] = [];

    // Check for vague quantifiers
    const vagueQuantifiers = ['some', 'few', 'several', 'many', 'most', 'usually', 'often'];
    for (const quantifier of vagueQuantifiers) {
      const regex = new RegExp(`\\b${quantifier}\\b`, 'gi');
      if (regex.test(promptContent)) {
        ambiguities.push(
          `Vague quantifier detected: "${quantifier}". Consider using specific numbers or ranges.`
        );
      }
    }

    // Check for undefined terms
    const undefinedTermPatterns = [
      /appropriate|suitable|reasonable|relevant/gi,
      /good|bad|better|worse/gi,
      /simple|complex|easy|hard/gi,
    ];

    for (const pattern of undefinedTermPatterns) {
      const matches = promptContent.match(pattern);
      if (matches && matches.length > 0) {
        ambiguities.push(
          `Subjective or underspecified term detected: "${matches[0]}". Define evaluation criteria explicitly.`
        );
      }
    }

    // Check for implicit conditionals
    if (/if|when|unless|in case/gi.test(promptContent)) {
      const hasExplicitElse = /else|otherwise|if not/gi.test(promptContent);
      if (!hasExplicitElse) {
        ambiguities.push(
          'Conditional logic detected without explicit else branch. Specify behavior for all cases.'
        );
      }
    }

    return ambiguities;
  }

  private identifyImplicitAssumptions(
    promptContent: string,
    components: Component[]
  ): string[] {
    const assumptions: string[] = [];

    // Check for examples without diversity
    const examples = components.filter((c) => c.component_type === 'example');
    if (examples.length > 0 && examples.length < 3) {
      assumptions.push(
        'Limited examples provided. Model may not generalize beyond demonstrated patterns.'
      );
    }

    // Check for unstated input format expectations
    if (!/input|provided|given|you will receive/gi.test(promptContent)) {
      assumptions.push(
        'No explicit input format specification. Model may misinterpret input structure.'
      );
    }

    // Check for cultural or domain-specific references
    const domainIndicators = [
      /e\.g\.|i\.e\.|etc\./gi,
      /assume|obviously|clearly|of course/gi,
    ];

    for (const pattern of domainIndicators) {
      if (pattern.test(promptContent)) {
        assumptions.push(
          'Implicit knowledge assumption detected. Verify that all necessary context is explicit.'
        );
      }
    }

    return assumptions;
  }

  private identifyProviderSensitivities(
    promptContent: string,
    components: Component[]
  ): string[] {
    const sensitivities: string[] = [];

    // Check for XML-style tags (Anthropic preference)
    if (/<[a-zA-Z][^>]*>/.test(promptContent)) {
      sensitivities.push(
        'XML-style tags detected. These work well with Anthropic models but may be misinterpreted by others.'
      );
    }

    // Check for JSON formatting requirements
    if (/json|{|}|\[|\]/gi.test(promptContent)) {
      sensitivities.push(
        'JSON output format detected. Ensure proper escaping and consider provider-specific JSON modes.'
      );
    }

    // Check for system message patterns
    if (/you are|your role|as an|act as/gi.test(promptContent)) {
      sensitivities.push(
        'Role assignment detected. Effectiveness varies by provider; OpenAI responds well to system messages.'
      );
    }

    // Check for token-sensitive constructs
    if (promptContent.length > 8000) {
      sensitivities.push(
        'Long prompt detected. Consider token limits and context window differences across providers.'
      );
    }

    return sensitivities;
  }

  private generateImprovementSuggestions(
    structural_issues: string[],
    ambiguities: string[],
    implicit_assumptions: string[]
  ): string[] {
    const suggestions: string[] = [];

    if (structural_issues.length > 0) {
      suggestions.push(
        'Address structural issues by adding missing component types or resolving dependencies.'
      );
    }

    if (ambiguities.length > 2) {
      suggestions.push(
        'High ambiguity detected. Revise vague terms with concrete specifications and explicit criteria.'
      );
    }

    if (implicit_assumptions.length > 0) {
      suggestions.push(
        'Make implicit assumptions explicit by adding context sections or defining domain-specific terms.'
      );
    }

    return suggestions;
  }
}
