import sharp from 'sharp';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import type { Filter } from '../types/api';
import { storageService, type UploadResult } from './StorageService';

export interface ProcessingOptions {
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
  width?: number;
  height?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
}

export interface FilterParameters {
  // Paper effects
  borderWidth?: number;
  borderColor?: string;
  shadow?: boolean;
  texture?: string;

  // Color effects
  brightness?: number;
  contrast?: number;
  saturation?: number;
  hue?: number;
  temperature?: number;
  sepia?: number;
  vignette?: number;
  grain?: number;

  // Custom parameters
  [key: string]: any;
}

export class ImageProcessor {
  private uploadsDir: string;
  private originalsDir: string;
  private thumbnailsDir: string;
  private processedDir: string;

  constructor() {
    this.uploadsDir = join(process.cwd(), 'uploads');
    this.originalsDir = join(this.uploadsDir, 'originals');
    this.thumbnailsDir = join(this.uploadsDir, 'thumbnails');
    this.processedDir = join(this.uploadsDir, 'processed');

    this.ensureDirectories();
  }

  private ensureDirectories() {
    [this.uploadsDir, this.originalsDir, this.thumbnailsDir, this.processedDir].forEach(dir => {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    });
  }

  async processUpload(
    file: Buffer,
    filename: string,
    options: ProcessingOptions = {}
  ): Promise<{
    originalPath: string;
    thumbnailPath: string;
    metadata: sharp.Metadata;
  }> {
    const originalPath = join(this.originalsDir, filename);
    const thumbnailFilename = this.getThumbnailFilename(filename);
    const thumbnailPath = join(this.thumbnailsDir, thumbnailFilename);

    try {
      // Get image metadata
      const image = sharp(file);
      const metadata = await image.metadata();

      console.log('Sharp metadata from uploaded file:', {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: file.length || 'unknown'
      });

      // Save original
      await image
        .jpeg({ quality: options.quality || 95 })
        .toFile(originalPath);

      // Create thumbnail
      await this.createThumbnail(file, thumbnailPath);

      return {
        originalPath: this.getRelativePath(originalPath),
        thumbnailPath: this.getRelativePath(thumbnailPath),
        metadata
      };

    } catch (error) {
      console.error('Error processing upload:', error);
      throw new Error(`Failed to process image: ${error}`);
    }
  }

  async createThumbnail(
    input: Buffer | string,
    outputPath: string,
    size: number = 300
  ): Promise<void> {
    await sharp(input)
      .resize(size, size, {
        fit: 'cover',
        withoutEnlargement: true
      })
      .jpeg({ quality: 80 })
      .toFile(outputPath);
  }

  async applyFilter(
    inputPath: string,
    filter: Filter,
    intensity: number = 1.0,
    customParams: FilterParameters = {}
  ): Promise<{
    processedPath: string;
    processingTimeMs: number;
    fileSize: number;
  }> {
    const startTime = Date.now();
    const absoluteInputPath = this.getAbsolutePath(inputPath);

    // Generate output filename
    const inputFilename = inputPath.split('/').pop()!;
    const ext = inputFilename.split('.').pop();
    const baseName = inputFilename.replace(`.${ext}`, '');
    const outputFilename = `${baseName}_${filter.name}.${ext}`;
    const outputPath = join(this.processedDir, outputFilename);

    try {
      let image = sharp(absoluteInputPath);

      // Parse filter parameters
      const parameters = { ...filter.parameters, ...customParams };
      console.log('Applying filter:', filter.name);
      console.log('Filter type:', filter.filterType);
      console.log('Filter parameters:', parameters);
      console.log('Intensity:', intensity);

      // Apply filter based on type
      switch (filter.filterType) {
        case 'paper':
          image = await this.applyPaperFilter(image, parameters, intensity);
          break;
        case 'color':
          image = await this.applyColorFilter(image, parameters, intensity);
          break;
        case 'composite':
          image = await this.applyCompositeFilter(image, parameters, intensity);
          break;
      }

      // Save processed image
      await image.jpeg({ quality: 85 }).toFile(outputPath);

      const stats = await Bun.file(outputPath).exists() ?
        await Bun.file(outputPath).size : 0;

      const processingTimeMs = Date.now() - startTime;

      return {
        processedPath: this.getRelativePath(outputPath),
        processingTimeMs,
        fileSize: stats
      };

    } catch (error) {
      console.error('Error applying filter:', error);
      throw new Error(`Failed to apply filter: ${error}`);
    }
  }

  private async applyPaperFilter(
    image: sharp.Sharp,
    params: FilterParameters,
    intensity: number
  ): Promise<sharp.Sharp> {
    const metadata = await image.metadata();
    const { width = 1000, height = 1000 } = metadata;

    // Instax-style polaroid frame
    if (params.instaxStyle && params.borderColor) {
      // Instax Mini dimensions: 54x86mm total, 46x62mm image area
      const instaxRatio = 54 / 86; // 0.628
      const imageAreaRatio = 46 / 62; // 0.742

      // Calculate target dimensions for a standard output size
      const baseSize = 600; // Base size for consistent output
      const targetFrameWidth = baseSize;
      const targetFrameHeight = Math.round(baseSize / instaxRatio); // ~955px for 600px width

      // Image area within the frame
      const imageAreaWidth = Math.round(targetFrameWidth * (46/54)); // ~511px
      const imageAreaHeight = Math.round(targetFrameHeight * (62/86)); // ~688px

      // Border calculations
      const sideBorder = Math.round((targetFrameWidth - imageAreaWidth) / 2);
      const topBorder = Math.round(targetFrameHeight * 0.08); // ~8% from top
      const bottomBorder = targetFrameHeight - imageAreaHeight - topBorder;

      console.log('Instax dimensions:', {
        frameWidth: targetFrameWidth,
        frameHeight: targetFrameHeight,
        imageWidth: imageAreaWidth,
        imageHeight: imageAreaHeight,
        borders: { top: topBorder, bottom: bottomBorder, side: sideBorder }
      });

      // Resize image to fit the image area
      image = image.resize(imageAreaWidth, imageAreaHeight, {
        fit: 'cover',
        position: 'center'
      });

      // Add polaroid frame
      image = image.extend({
        top: topBorder,
        bottom: bottomBorder,
        left: sideBorder,
        right: sideBorder,
        background: params.borderColor || '#ffffff'
      });

      // Add subtle rounded corners effect
      const cornerRadius = 8;
      image = image.composite([{
        input: Buffer.from(`
          <svg width="${targetFrameWidth}" height="${targetFrameHeight}">
            <defs>
              <mask id="rounded">
                <rect width="100%" height="100%" fill="white" rx="${cornerRadius}" ry="${cornerRadius}"/>
              </mask>
            </defs>
            <rect width="100%" height="100%" fill="transparent" mask="url(#rounded)"/>
          </svg>
        `),
        top: 0,
        left: 0,
        blend: 'dest-in'
      }]);

      // Add subtle texture to the border if specified
      if (params.texture && intensity > 0.3) {
        const textureOpacity = Math.min(0.1, intensity * 0.15);
        image = image.composite([{
          input: Buffer.from(`
            <svg width="${targetFrameWidth}" height="${targetFrameHeight}">
              <defs>
                <filter id="paper-texture">
                  <feTurbulence baseFrequency="0.04" numOctaves="3" result="noise"/>
                  <feColorMatrix in="noise" type="saturate" values="0"/>
                  <feBlend mode="multiply" opacity="${textureOpacity}"/>
                </filter>
              </defs>
              <rect width="100%" height="100%" fill="${params.borderColor || '#ffffff'}" filter="url(#paper-texture)"/>
            </svg>
          `),
          top: 0,
          left: 0,
          blend: 'overlay'
        }]);
      }

    } else if (params.borderWidth && params.borderColor) {
      // Regular border for non-instax filters
      const borderSize = Math.round((params.borderWidth * intensity) * Math.min(width, height));

      image = image.extend({
        top: borderSize,
        bottom: borderSize,
        left: borderSize,
        right: borderSize,
        background: params.borderColor
      });
    }

    // Add shadow effect
    if (params.shadow && intensity > 0.5) {
      // Simple shadow simulation with slight blur and offset
      // This is a simplified version - more complex shadows would require composite operations
    }

    return image;
  }

  private async applyColorFilter(
    image: sharp.Sharp,
    params: FilterParameters,
    intensity: number
  ): Promise<sharp.Sharp> {
    const operations: any = {};

    // Brightness
    if (params.brightness !== undefined) {
      const brightness = 1 + ((params.brightness - 1) * intensity);
      operations.brightness = brightness;
    }

    // Contrast
    if (params.contrast !== undefined) {
      const contrast = 1 + ((params.contrast - 1) * intensity);
      operations.contrast = contrast;
    }

    // Saturation
    if (params.saturation !== undefined) {
      const saturation = 1 + ((params.saturation - 1) * intensity);
      operations.saturation = saturation;
    }

    // Hue shift
    if (params.hue !== undefined) {
      const hue = params.hue * intensity;
      operations.hue = hue;
    }

    // Apply modulate operations
    if (Object.keys(operations).length > 0) {
      image = image.modulate(operations);
    }

    // Temperature adjustment (simplified)
    if (params.temperature !== undefined) {
      const temp = params.temperature * intensity;
      if (temp > 0) {
        // Warm - add red/yellow
        image = image.tint({ r: 255, g: 200, b: 150 });
      } else {
        // Cool - add blue
        image = image.tint({ r: 150, g: 200, b: 255 });
      }
    }

    // Sepia effect
    if (params.sepia !== undefined && params.sepia > 0) {
      const sepiaIntensity = params.sepia * intensity;
      console.log('Applying sepia effect:', sepiaIntensity);
      if (sepiaIntensity > 0.1) {
        // Convert to sepia using a sepia matrix approximation
        image = image.modulate({
          saturation: 1 - sepiaIntensity * 0.8,
          brightness: 1 + sepiaIntensity * 0.1
        }).tint({ r: 255, g: 240, b: 200 });
        console.log('Sepia applied with modulate and tint');
      }
    }

    return image;
  }

  private async applyCompositeFilter(
    image: sharp.Sharp,
    params: FilterParameters,
    intensity: number
  ): Promise<sharp.Sharp> {
    // Composite filters combine multiple effects
    // Apply paper effects first
    image = await this.applyPaperFilter(image, params, intensity);

    // Then apply color effects
    image = await this.applyColorFilter(image, params, intensity);

    return image;
  }

  async optimizeForPrint(
    inputPath: string,
    outputPath: string,
    paperSize: '4x6' | '5x7' | '8x10' = '4x6'
  ): Promise<void> {
    const dimensions = this.getPrintDimensions(paperSize);
    const absoluteInputPath = this.getAbsolutePath(inputPath);

    await sharp(absoluteInputPath)
      .resize(dimensions.width, dimensions.height, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .jpeg({ quality: 95 })
      .toFile(outputPath);
  }

  private getPrintDimensions(paperSize: string): { width: number; height: number } {
    const dimensions = {
      '4x6': { width: 1800, height: 1200 }, // 300 DPI
      '5x7': { width: 2100, height: 1500 },
      '8x10': { width: 3000, height: 2400 }
    };

    return dimensions[paperSize as keyof typeof dimensions] || dimensions['4x6'];
  }

  private getThumbnailFilename(filename: string): string {
    const ext = filename.split('.').pop();
    const baseName = filename.replace(`.${ext}`, '');
    return `${baseName}_thumb.${ext}`;
  }

  private getRelativePath(absolutePath: string): string {
    return absolutePath.replace(process.cwd(), '').replace(/^\//, '');
  }

  private getAbsolutePath(relativePath: string): string {
    if (relativePath.startsWith('/')) {
      return relativePath;
    }
    return join(process.cwd(), relativePath);
  }

  async getImageInfo(path: string): Promise<sharp.Metadata> {
    const absolutePath = this.getAbsolutePath(path);
    return await sharp(absolutePath).metadata();
  }

  async deleteFile(path: string): Promise<void> {
    const absolutePath = this.getAbsolutePath(path);
    try {
      if (existsSync(absolutePath)) {
        await Bun.file(absolutePath).exists() && await Bun.$`rm ${absolutePath}`;
      }
    } catch (error) {
      console.error('Error deleting file:', error);
    }
  }
}