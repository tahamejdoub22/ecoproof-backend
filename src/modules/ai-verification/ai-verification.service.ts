import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { MaterialType } from '../../entities/recycling-point.entity';

export interface AIVerificationResult {
  objectType: string;
  confidence: number;
  authentic: boolean;
  quality: string;
  reasoning: string;
  provider?: string; // Which AI provider was used
}

export interface AIVerificationResponse {
  success: boolean;
  result: AIVerificationResult | null;
  score: number; // 0-1 verification score
  error?: string;
  provider?: string;
}

export enum AIProvider {
  GEMINI = 'gemini', // Google Gemini Vision (BEST - Free tier: 60 req/min)
  OLLAMA = 'ollama', // Local Ollama (Fallback)
  HUGGINGFACE = 'huggingface', // Hugging Face Inference (Alternative)
}

@Injectable()
export class AIVerificationService {
  private readonly logger = new Logger(AIVerificationService.name);
  
  // Gemini Configuration
  private readonly geminiApiKey: string | null;
  private readonly geminiModel: string;
  private readonly geminiBaseUrl = 'https://generativelanguage.googleapis.com/v1beta';
  
  // Ollama Configuration
  private readonly ollamaBaseUrl: string;
  private readonly ollamaModel: string;
  
  // Hugging Face Configuration
  private readonly huggingfaceApiKey: string | null;
  private readonly huggingfaceModel: string;
  
  // General Configuration
  private readonly timeout: number;
  private readonly enabled: boolean;
  private readonly preferredProvider: AIProvider;
  private readonly fallbackProviders: AIProvider[];

  constructor(private configService: ConfigService) {
    // Gemini (Primary - Best accuracy)
    this.geminiApiKey = this.configService.get('GEMINI_API_KEY') || null;
    this.geminiModel = this.configService.get('GEMINI_MODEL') || 'gemini-1.5-flash';
    
    // Ollama (Fallback)
    this.ollamaBaseUrl = this.configService.get('OLLAMA_BASE_URL') || 'http://localhost:11434';
    this.ollamaModel = this.configService.get('OLLAMA_MODEL') || 'llava:13b';
    
    // Hugging Face (Alternative)
    this.huggingfaceApiKey = this.configService.get('HUGGINGFACE_API_KEY') || null;
    this.huggingfaceModel = this.configService.get('HUGGINGFACE_MODEL') || 'Salesforce/blip2-opt-2.7b';
    
    // General
    this.timeout = this.configService.get('AI_VERIFICATION_TIMEOUT') || 30000;
    this.enabled = this.configService.get('AI_VERIFICATION_ENABLED') !== 'false';
    
    // Provider priority: Gemini > Ollama > HuggingFace
    const providerStr = this.configService.get('AI_PROVIDER') || 'gemini';
    this.preferredProvider = AIProvider[providerStr.toUpperCase()] || AIProvider.GEMINI;
    
    // Setup fallback chain
    this.fallbackProviders = [AIProvider.OLLAMA, AIProvider.HUGGINGFACE];
    
    this.logger.log(`AI Verification enabled: ${this.preferredProvider} (primary)`);
    if (this.geminiApiKey) {
      this.logger.log('✅ Google Gemini API configured (BEST accuracy)');
    }
    if (this.ollamaBaseUrl) {
      this.logger.log('✅ Ollama configured (fallback)');
    }
  }

  /**
   * Verify image using AI (tries multiple providers with fallback)
   * Priority: Gemini > Ollama > HuggingFace
   */
  async verifyImage(
    imageUrl: string,
    claimedObjectType: MaterialType,
  ): Promise<AIVerificationResponse> {
    if (!this.enabled) {
      this.logger.warn('AI Verification disabled, skipping...');
      return {
        success: true,
        result: null,
        score: 0.5, // Neutral score when disabled
      };
    }

    const providers = [this.preferredProvider, ...this.fallbackProviders];
    
    for (const provider of providers) {
      try {
        this.logger.debug(`Trying AI provider: ${provider}`);
        const result = await this.verifyWithProvider(provider, imageUrl, claimedObjectType);
        
        if (result.success) {
          this.logger.log(`✅ AI Verification successful with ${provider}`);
          return result;
        }
      } catch (error) {
        this.logger.warn(`Provider ${provider} failed: ${error.message}, trying fallback...`);
        continue;
      }
    }

    // All providers failed
    this.logger.error('All AI providers failed');
    return {
      success: false,
      result: null,
      score: 0.0,
      error: 'All AI verification providers failed',
    };
  }

  /**
   * Verify with specific provider
   */
  private async verifyWithProvider(
    provider: AIProvider,
    imageUrl: string,
    claimedObjectType: MaterialType,
  ): Promise<AIVerificationResponse> {
    const imagePath = await this.downloadImage(imageUrl);
    const imageBase64 = await this.imageToBase64(imagePath);

    try {
      let aiResponse: string;
      let usedProvider: string;

      switch (provider) {
        case AIProvider.GEMINI:
          if (!this.geminiApiKey) {
            throw new Error('Gemini API key not configured');
          }
          aiResponse = await this.callGemini(imageBase64, claimedObjectType);
          usedProvider = 'gemini';
          break;

        case AIProvider.OLLAMA:
          aiResponse = await this.callOllama(imageBase64, claimedObjectType);
          usedProvider = 'ollama';
          break;

        case AIProvider.HUGGINGFACE:
          if (!this.huggingfaceApiKey) {
            throw new Error('Hugging Face API key not configured');
          }
          aiResponse = await this.callHuggingFace(imageBase64, claimedObjectType);
          usedProvider = 'huggingface';
          break;

        default:
          throw new Error(`Unknown provider: ${provider}`);
      }

      // Parse and validate response
      const result = this.parseAIResponse(aiResponse);
      result.provider = usedProvider;

      // Calculate verification score
      const score = this.calculateVerificationScore(result, claimedObjectType);

      // Cleanup
      await this.cleanupImage(imagePath);

      return {
        success: true,
        result,
        score,
        provider: usedProvider,
      };
    } catch (error) {
      await this.cleanupImage(imagePath);
      throw error;
    }
  }

  /**
   * Download image from URL to temporary file
   */
  private async downloadImage(imageUrl: string): Promise<string> {
    try {
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 10000,
      });

      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const tempPath = path.join(tempDir, `image_${Date.now()}.jpg`);
      fs.writeFileSync(tempPath, response.data);

      return tempPath;
    } catch (error) {
      throw new HttpException(
        `Failed to download image: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Convert image to base64
   */
  private async imageToBase64(imagePath: string): Promise<string> {
    const imageBuffer = fs.readFileSync(imagePath);
    return imageBuffer.toString('base64');
  }

  /**
   * Call Google Gemini Vision API (BEST accuracy, free tier)
   */
  private async callGemini(imageBase64: string, claimedObjectType: MaterialType): Promise<string> {
    const prompt = this.buildPrompt(claimedObjectType);

    try {
      const response = await axios.post(
        `${this.geminiBaseUrl}/models/${this.geminiModel}:generateContent?key=${this.geminiApiKey}`,
        {
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
                {
                  inline_data: {
                    mime_type: 'image/jpeg',
                    data: imageBase64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1, // Low temperature for consistent results
            topK: 1,
            topP: 0.8,
            maxOutputTokens: 500,
            responseMimeType: 'application/json',
          },
        },
        {
          timeout: this.timeout,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error('No response from Gemini API');
      }

      return text;
    } catch (error) {
      if (error.response?.status === 429) {
        throw new HttpException(
          'Gemini API rate limit exceeded. Please try again later.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      if (error.response?.status === 401) {
        throw new HttpException(
          'Gemini API key is invalid.',
          HttpStatus.UNAUTHORIZED,
        );
      }
      throw new HttpException(
        `Gemini API error: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Call Ollama API with image and prompt (Fallback)
   */
  private async callOllama(imageBase64: string, claimedObjectType: MaterialType): Promise<string> {
    const prompt = this.buildPrompt(claimedObjectType);

    try {
      const response = await axios.post(
        `${this.ollamaBaseUrl}/api/generate`,
        {
          model: this.ollamaModel,
          prompt: prompt,
          images: [imageBase64],
          stream: false,
          format: 'json',
        },
        {
          timeout: this.timeout,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      return response.data.response || response.data;
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        throw new HttpException(
          'Ollama service is not available. Please ensure Ollama is running.',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
      throw new HttpException(
        `Ollama API error: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Call Hugging Face Inference API (Alternative fallback)
   */
  private async callHuggingFace(
    imageBase64: string,
    claimedObjectType: MaterialType,
  ): Promise<string> {
    // Hugging Face requires different approach - use image-to-text model
    try {
      const response = await axios.post(
        `https://api-inference.huggingface.co/models/${this.huggingfaceModel}`,
        {
          inputs: {
            image: `data:image/jpeg;base64,${imageBase64}`,
            question: `What recycling material is in this image? Options: plastic_bottle, aluminum_can, glass_bottle, paper, cardboard. Is it authentic?`,
          },
        },
        {
          timeout: this.timeout,
          headers: {
            Authorization: `Bearer ${this.huggingfaceApiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      // Hugging Face returns different format, need to parse
      const answer = response.data.answer || JSON.stringify(response.data);
      return this.formatHuggingFaceResponse(answer, claimedObjectType);
    } catch (error) {
      throw new HttpException(
        `Hugging Face API error: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Format Hugging Face response to match our expected format
   */
  private formatHuggingFaceResponse(answer: string, claimedObjectType: MaterialType): string {
    // Try to extract object type and create JSON response
    const objectTypes = ['plastic_bottle', 'aluminum_can', 'glass_bottle', 'paper', 'cardboard'];
    let detectedType = claimedObjectType; // Default to claimed type
    let confidence = 0.7; // Default confidence

    // Simple parsing (can be improved)
    for (const type of objectTypes) {
      if (answer.toLowerCase().includes(type.replace('_', ' '))) {
        detectedType = type;
        confidence = 0.8;
        break;
      }
    }

    return JSON.stringify({
      object_type: detectedType,
      confidence: confidence,
      authentic: !answer.toLowerCase().includes('fake') && !answer.toLowerCase().includes('edited'),
      quality: answer.toLowerCase().includes('clear') ? 'good' : 'fair',
      reasoning: answer,
    });
  }

  /**
   * Build prompt for Ollama
   */
  private buildPrompt(claimedObjectType: MaterialType): string {
    return `You are an expert recycling verification system. Analyze this image carefully.

Task:
1. Identify the object type. It must be one of: plastic_bottle, aluminum_can, glass_bottle, paper, cardboard
2. Rate your confidence (0.0 to 1.0)
3. Determine if the image is authentic (not edited, not a screenshot, not AI-generated, not a stock photo)
4. Assess image quality (good/fair/poor)

The user claims this is: ${claimedObjectType}

Respond ONLY with valid JSON in this exact format:
{
  "object_type": "plastic_bottle",
  "confidence": 0.92,
  "authentic": true,
  "quality": "good",
  "reasoning": "I can clearly see a plastic bottle in the image. The image appears to be a real photo taken with a camera, not edited or manipulated. The object is clearly visible and in good quality."
}

Important:
- object_type must match one of: plastic_bottle, aluminum_can, glass_bottle, paper, cardboard
- confidence must be between 0.0 and 1.0
- authentic must be true or false
- quality must be: good, fair, or poor
- Be strict about authenticity - reject if image looks fake, edited, or stock photo`;
  }

  /**
   * Parse AI response JSON
   */
  private parseAIResponse(aiResponse: string): AIVerificationResult {
    try {
      // Extract JSON from response (in case there's extra text)
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate structure
      if (
        !parsed.object_type ||
        typeof parsed.confidence !== 'number' ||
        typeof parsed.authentic !== 'boolean' ||
        !parsed.quality ||
        !parsed.reasoning
      ) {
        throw new Error('Invalid AI response structure');
      }

      // Validate object type
      const validTypes = ['plastic_bottle', 'aluminum_can', 'glass_bottle', 'paper', 'cardboard'];
      if (!validTypes.includes(parsed.object_type)) {
        throw new Error(`Invalid object type: ${parsed.object_type}`);
      }

      // Validate confidence range
      if (parsed.confidence < 0 || parsed.confidence > 1) {
        throw new Error(`Invalid confidence: ${parsed.confidence}`);
      }

      // Validate quality
      const validQualities = ['good', 'fair', 'poor'];
      if (!validQualities.includes(parsed.quality)) {
        throw new Error(`Invalid quality: ${parsed.quality}`);
      }

      return {
        objectType: parsed.object_type,
        confidence: parsed.confidence,
        authentic: parsed.authentic,
        quality: parsed.quality,
        reasoning: parsed.reasoning,
      };
    } catch (error) {
      this.logger.error(`Failed to parse AI response: ${error.message}`);
      this.logger.debug(`AI Response: ${aiResponse}`);
      throw new Error(`Failed to parse AI response: ${error.message}`);
    }
  }

  /**
   * Calculate verification score based on AI result
   */
  private calculateVerificationScore(
    result: AIVerificationResult,
    claimedObjectType: MaterialType,
  ): number {
    let score = 0.0;

    // 1. Object type match (50% weight)
    if (result.objectType === claimedObjectType) {
      score += 0.5;
    } else {
      // Partial match (e.g., both are bottles)
      const bothBottles =
        (result.objectType.includes('bottle') && claimedObjectType.includes('bottle')) ||
        (result.objectType === 'paper' && claimedObjectType === 'cardboard') ||
        (result.objectType === 'cardboard' && claimedObjectType === 'paper');
      if (bothBottles) {
        score += 0.25; // Partial credit
      }
    }

    // 2. AI confidence (30% weight)
    score += result.confidence * 0.3;

    // 3. Authenticity (20% weight)
    if (result.authentic) {
      score += 0.2;
    }

    // Quality affects score (bonus/penalty)
    if (result.quality === 'good') {
      score = Math.min(1.0, score + 0.1);
    } else if (result.quality === 'poor') {
      score = Math.max(0.0, score - 0.2);
    }

    return Math.max(0.0, Math.min(1.0, score));
  }

  /**
   * Cleanup temporary image file
   */
  private async cleanupImage(imagePath: string): Promise<void> {
    try {
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    } catch (error) {
      this.logger.warn(`Failed to cleanup image: ${imagePath}`, error);
    }
  }

  /**
   * Health check for AI services
   */
  async healthCheck(): Promise<{ provider: string; healthy: boolean; error?: string }[]> {
    if (!this.enabled) {
      return [{ provider: 'disabled', healthy: true }];
    }

    const checks: { provider: string; healthy: boolean; error?: string }[] = [];

    // Check Gemini
    if (this.geminiApiKey) {
      try {
        const response = await axios.get(
          `${this.geminiBaseUrl}/models/${this.geminiModel}?key=${this.geminiApiKey}`,
          { timeout: 5000 },
        );
        checks.push({
          provider: 'gemini',
          healthy: response.status === 200,
        });
      } catch (error) {
        checks.push({
          provider: 'gemini',
          healthy: false,
          error: error.message,
        });
      }
    }

    // Check Ollama
    try {
      const response = await axios.get(`${this.ollamaBaseUrl}/api/tags`, {
        timeout: 5000,
      });
      checks.push({
        provider: 'ollama',
        healthy: response.status === 200,
      });
    } catch (error) {
      checks.push({
        provider: 'ollama',
        healthy: false,
        error: error.message,
      });
    }

    return checks;
  }
}
