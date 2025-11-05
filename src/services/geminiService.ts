import { GoogleGenAI } from '@google/genai';
import logger from '../utils/logger';

interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
}

class GeminiService {
  private ai: GoogleGenAI;
  private model: string = 'gemini-2.0-flash-exp';
  private retryConfig: RetryConfig = {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000
  };

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not set in environment variables');
    }
    this.ai = new GoogleGenAI({ apiKey });
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        
        // Check if error is rate limit (429) or server error (5xx)
        const isRetryable = 
          error.status === 429 || 
          (error.status && error.status >= 500) ||
          error.message?.includes('quota') ||
          error.message?.includes('rate');
        
        if (!isRetryable || attempt === this.retryConfig.maxRetries) {
          throw error;
        }

        const delayMs = Math.min(
          this.retryConfig.initialDelayMs * Math.pow(2, attempt - 1),
          this.retryConfig.maxDelayMs
        );
        
        logger.warn(`${operationName} failed, retrying in ${delayMs}ms`, {
          attempt,
          max_retries: this.retryConfig.maxRetries,
          error_message: error.message,
          next_retry_ms: delayMs
        });
        
        await this.sleep(delayMs);
      }
    }
    
    throw lastError;
  }

  async grammarCheck(text: string): Promise<string> {
    const start = performance.now();
    
    logger.info('AI grammar check started', {
      text_length: text.length,
      operation: 'grammar-check',
      model: this.model
    });
    
    try {
      const prompt = `You are a grammar and style checker. Analyze the following text and provide detailed feedback on:
1. Grammar errors
2. Style improvements
3. Clarity suggestions
4. Tone assessment

Format your response as a structured list with specific corrections.

Text to analyze:
${text}`;

      const response = await this.retryWithBackoff(
        () => this.ai.models.generateContent({
          model: this.model,
          contents: prompt
        }),
        'Grammar check'
      );

      const elapsed = Math.round(performance.now() - start);
      
      logger.info('AI grammar check completed', {
        text_length: text.length,
        result_length: response.text?.length || 0,
        elapsed_ms: elapsed,
        model: this.model,
        success: true
      });

      return response.text || 'No suggestions available';
    } catch (error: any) {
      const elapsed = Math.round(performance.now() - start);
      
      logger.error('AI grammar check failed', {
        text_length: text.length,
        error_type: error.constructor?.name || 'Error',
        error_message: error.message,
        elapsed_ms: elapsed,
        model: this.model
      });
      
      // Graceful error handling - return user-friendly message
      if (error.message?.includes('quota') || error.status === 429) {
        throw new Error('AI service rate limit reached. Please try again in a few moments.');
      } else if (error.status >= 500) {
        throw new Error('AI service is temporarily unavailable. Please try again later.');
      } else if (error.message?.includes('API')) {
        throw new Error('Failed to connect to AI service. Please check your connection and try again.');
      }
      
      throw new Error('Failed to check grammar: ' + error.message);
    }
  }

  async enhanceText(text: string): Promise<string> {
    const start = performance.now();
    
    logger.info('AI text enhancement started', {
      text_length: text.length,
      operation: 'enhance',
      model: this.model
    });
    
    try {
      const prompt = `Improve the following text by:
1. Enhancing clarity and readability
2. Improving word choice and flow
3. Maintaining the original meaning and tone
4. Making it more professional and polished

Original text:
${text}

Provide only the improved version without explanations.`;

      const response = await this.retryWithBackoff(
        () => this.ai.models.generateContent({
          model: this.model,
          contents: prompt
        }),
        'Text enhancement'
      );

      const elapsed = Math.round(performance.now() - start);
      
      logger.info('AI text enhancement completed', {
        text_length: text.length,
        result_length: response.text?.length || 0,
        elapsed_ms: elapsed,
        model: this.model,
        success: true
      });

      return response.text || text;
    } catch (error: any) {
      const elapsed = Math.round(performance.now() - start);
      
      logger.error('AI text enhancement failed', {
        text_length: text.length,
        error_type: error.constructor?.name || 'Error',
        error_message: error.message,
        elapsed_ms: elapsed,
        model: this.model
      });
      
      // Graceful degradation - return original text on error
      if (error.message?.includes('rate limit') || error.status === 429) {
        throw new Error('AI service rate limit reached. Please try again in a few moments.');
      }
      
      throw new Error('Failed to enhance text: ' + error.message);
    }
  }

  async summarizeText(text: string): Promise<string> {
    const start = performance.now();
    
    logger.info('AI summarization started', {
      text_length: text.length,
      operation: 'summarize',
      model: this.model
    });
    
    try {
      const prompt = `Summarize the following text concisely. Capture the main points and key ideas in 2-3 paragraphs:

${text}`;

      const response = await this.retryWithBackoff(
        () => this.ai.models.generateContent({
          model: this.model,
          contents: prompt
        }),
        'Text summarization'
      );

      const elapsed = Math.round(performance.now() - start);
      
      logger.info('AI summarization completed', {
        text_length: text.length,
        result_length: response.text?.length || 0,
        elapsed_ms: elapsed,
        model: this.model,
        success: true
      });

      return response.text || 'No summary available';
    } catch (error: any) {
      const elapsed = Math.round(performance.now() - start);
      
      logger.error('AI summarization failed', {
        text_length: text.length,
        error_type: error.constructor?.name || 'Error',
        error_message: error.message,
        elapsed_ms: elapsed,
        model: this.model
      });
      
      if (error.message?.includes('rate limit') || error.status === 429) {
        throw new Error('AI service rate limit reached. Please try again in a few moments.');
      }
      
      throw new Error('Failed to summarize text: ' + error.message);
    }
  }

  async completeText(text: string, contextBefore: string = ''): Promise<string> {
    const start = performance.now();
    
    logger.info('AI text completion started', {
      text_length: text.length,
      context_length: contextBefore.length,
      operation: 'complete',
      model: this.model
    });
    
    try {
      const prompt = `Based on the context and the partial text, provide a natural completion that fits seamlessly.

Context:
${contextBefore}

Partial text to complete:
${text}

Provide only the completion (the next few words/sentences) without repeating the original text.`;

      const response = await this.retryWithBackoff(
        () => this.ai.models.generateContent({
          model: this.model,
          contents: prompt
        }),
        'Text completion'
      );

      const elapsed = Math.round(performance.now() - start);
      
      logger.info('AI text completion completed', {
        text_length: text.length,
        result_length: response.text?.length || 0,
        elapsed_ms: elapsed,
        model: this.model,
        success: true
      });

      return response.text || '';
    } catch (error: any) {
      const elapsed = Math.round(performance.now() - start);
      
      logger.error('AI text completion failed', {
        text_length: text.length,
        error_type: error.constructor?.name || 'Error',
        error_message: error.message,
        elapsed_ms: elapsed,
        model: this.model
      });
      
      if (error.message?.includes('rate limit') || error.status === 429) {
        throw new Error('AI service rate limit reached. Please try again in a few moments.');
      }
      
      throw new Error('Failed to complete text: ' + error.message);
    }
  }

  async getSuggestions(text: string, suggestionType: string = 'general'): Promise<string> {
    const start = performance.now();
    
    logger.info('AI suggestions started', {
      text_length: text.length,
      suggestion_type: suggestionType,
      operation: 'suggestions',
      model: this.model
    });
    
    try {
      const prompt = `Provide 3-5 specific ${suggestionType} suggestions to improve the following text:

${text}

Format your response as a numbered list with actionable suggestions.`;

      const response = await this.retryWithBackoff(
        () => this.ai.models.generateContent({
          model: this.model,
          contents: prompt
        }),
        'Getting suggestions'
      );

      const elapsed = Math.round(performance.now() - start);
      
      logger.info('AI suggestions completed', {
        text_length: text.length,
        result_length: response.text?.length || 0,
        elapsed_ms: elapsed,
        model: this.model,
        success: true
      });

      return response.text || 'No suggestions available';
    } catch (error: any) {
      const elapsed = Math.round(performance.now() - start);
      
      logger.error('AI suggestions failed', {
        text_length: text.length,
        error_type: error.constructor?.name || 'Error',
        error_message: error.message,
        elapsed_ms: elapsed,
        model: this.model
      });
      
      if (error.message?.includes('rate limit') || error.status === 429) {
        throw new Error('AI service rate limit reached. Please try again in a few moments.');
      }
      
      throw new Error('Failed to get suggestions: ' + error.message);
    }
  }
}

export default new GeminiService();
