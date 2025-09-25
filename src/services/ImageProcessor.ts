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

  // Advanced color adjustments
  shadows?: number;
  highlights?: number;
  clarity?: number;
  soft_light?: number;

  // Color boosts
  red_boost?: number;
  blue_boost?: number;
  green_boost?: number;
  orange_boost?: number;

  // Tint effects
  yellow_tint?: number;
  red_leak?: number;
  fade?: number;

  // Artistic effects
  color_shift?: number;
  blue_shadows?: number;
  blur_edges?: number;

  // Paper/border effects
  bottom_border?: number;
  rounded_corners?: number;
  torn_effect?: boolean;
  tape_effect?: boolean;
  corners?: boolean;

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
      console.log('=== FILTER APPLICATION START ===');
      console.log('Filter name:', filter.name);
      console.log('Filter type:', filter.filterType);
      console.log('Raw filter.parameters:', filter.parameters);
      console.log('Merged parameters:', parameters);
      console.log('Intensity:', intensity);
      console.log('Input path:', inputPath);

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
      console.log('Saving processed image to:', outputPath);
      await image.jpeg({ quality: 85 }).toFile(outputPath);

      const stats = await Bun.file(outputPath).exists() ?
        await Bun.file(outputPath).size : 0;

      const processingTimeMs = Date.now() - startTime;

      console.log('=== FILTER APPLICATION COMPLETE ===');
      console.log('Output path:', this.getRelativePath(outputPath));
      console.log('File size:', stats);
      console.log('Processing time:', processingTimeMs + 'ms');
      console.log('=======================================');

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

    console.log('=== PAPER FILTER START ===');
    console.log('Image dimensions:', { width, height });
    console.log('Paper filter params:', params);
    console.log('Intensity:', intensity);

    // Instax-style polaroid frame
    if (params.instaxStyle && params.borderColor) {
      console.log('Applying Instax-style frame');
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

    } else if (((params.borderWidth || params.border_width) && (params.borderColor || params.border_color)) ||
               (params.torn_effect || params.tape_effect || params.shadow)) {
      // Support both camelCase and snake_case parameter names
      const borderWidth = params.borderWidth || params.border_width || 0;
      const borderColor = params.borderColor || params.border_color || '#ffffff';

      console.log('Applying regular border with params:', {
        borderWidth,
        borderColor,
        intensity,
        hasEffects: {
          torn_effect: !!params.torn_effect,
          tape_effect: !!params.tape_effect,
          shadow: !!params.shadow,
          bottom_border: params.bottom_border,
          rounded_corners: params.rounded_corners
        }
      });

      // Only apply border if we have border width (not just effects)
      const shouldApplyBorder = borderWidth > 0;
      let topBorder = 0, bottomBorder = 0, leftBorder = 0, rightBorder = 0;

      if (shouldApplyBorder) {
        // Regular border for non-instax filters
        let borderSize = Math.round((borderWidth * intensity) * Math.min(width, height));
        topBorder = borderSize;
        bottomBorder = borderSize;
        leftBorder = borderSize;
        rightBorder = borderSize;

        // Special handling for polaroid frame
        if (params.bottom_border !== undefined) {
          bottomBorder = Math.round((params.bottom_border * intensity) * Math.min(width, height));
          console.log('Applied bottom_border adjustment:', bottomBorder);
        }

        console.log('Calculated border sizes:', { borderSize, topBorder, bottomBorder, leftBorder, rightBorder });

        console.log('Extending image with borders...');
        image = image.extend({
          top: topBorder,
          bottom: bottomBorder,
          left: leftBorder,
          right: rightBorder,
          background: borderColor
        });
        console.log('Image extended successfully');
      } else {
        console.log('Skipping border application, no border width specified');
      }

      // Add rounded corners if specified
      if (params.rounded_corners !== undefined && params.rounded_corners > 0) {
        const cornerRadius = Math.round(params.rounded_corners * intensity * Math.min(width + leftBorder + rightBorder, height + topBorder + bottomBorder));
        const totalWidth = width + leftBorder + rightBorder;
        const totalHeight = height + topBorder + bottomBorder;

        image = image.composite([{
          input: Buffer.from(`
            <svg width="${totalWidth}" height="${totalHeight}">
              <defs>
                <mask id="rounded">
                  <rect width="100%" height="100%" fill="white" rx="${cornerRadius}" ry="${cornerRadius}"/>
                </mask>
              </defs>
              <rect width="100%" height="100%" fill="white" mask="url(#rounded)"/>
            </svg>
          `),
          top: 0,
          left: 0,
          blend: 'dest-in'
        }]);
      }

      // Add tape effect for corners
      if (params.tape_effect && params.corners) {
        const totalWidth = width + leftBorder + rightBorder;
        const totalHeight = height + topBorder + bottomBorder;
        const tapeSize = Math.min(totalWidth, totalHeight) * 0.08;
        const tapeThickness = tapeSize * 0.4;

        // Add realistic tape corners with shadow and texture
        const tapeOverlay = Buffer.from(`
          <svg width="${totalWidth}" height="${totalHeight}">
            <defs>
              <filter id="tapeShadow">
                <feDropShadow dx="1" dy="1" stdDeviation="1" flood-opacity="0.2"/>
              </filter>
              <linearGradient id="tapeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#f8f8f8;stop-opacity:0.95" />
                <stop offset="50%" style="stop-color:#ffffff;stop-opacity:0.9" />
                <stop offset="100%" style="stop-color:#f0f0f0;stop-opacity:0.85" />
              </linearGradient>
            </defs>

            <!-- Top-left tape -->
            <rect x="${tapeSize * 0.1}" y="${tapeSize * 0.1}"
                  width="${tapeSize}" height="${tapeThickness}"
                  fill="url(#tapeGrad)" opacity="0.9"
                  rx="2" ry="2" filter="url(#tapeShadow)"
                  transform="rotate(-15 ${tapeSize * 0.6} ${tapeSize * 0.3})"/>

            <!-- Top-right tape -->
            <rect x="${totalWidth - tapeSize - tapeSize * 0.1}" y="${tapeSize * 0.1}"
                  width="${tapeSize}" height="${tapeThickness}"
                  fill="url(#tapeGrad)" opacity="0.9"
                  rx="2" ry="2" filter="url(#tapeShadow)"
                  transform="rotate(15 ${totalWidth - tapeSize * 0.6} ${tapeSize * 0.3})"/>

            <!-- Bottom-left tape -->
            <rect x="${tapeSize * 0.1}" y="${totalHeight - tapeSize * 0.4}"
                  width="${tapeSize}" height="${tapeThickness}"
                  fill="url(#tapeGrad)" opacity="0.9"
                  rx="2" ry="2" filter="url(#tapeShadow)"
                  transform="rotate(15 ${tapeSize * 0.6} ${totalHeight - tapeSize * 0.2})"/>

            <!-- Bottom-right tape -->
            <rect x="${totalWidth - tapeSize - tapeSize * 0.1}" y="${totalHeight - tapeSize * 0.4}"
                  width="${tapeSize}" height="${tapeThickness}"
                  fill="url(#tapeGrad)" opacity="0.9"
                  rx="2" ry="2" filter="url(#tapeShadow)"
                  transform="rotate(-15 ${totalWidth - tapeSize * 0.6} ${totalHeight - tapeSize * 0.2})"/>
          </svg>
        `);

        image = image.composite([{
          input: tapeOverlay,
          top: 0,
          left: 0,
          blend: 'over'
        }]);
      }

      // Add torn edges effect
      if (params.torn_effect) {
        const totalWidth = width + leftBorder + rightBorder;
        const totalHeight = height + topBorder + bottomBorder;

        // Create a torn edge mask with irregular border
        const tornMask = Buffer.from(`
          <svg width="${totalWidth}" height="${totalHeight}">
            <defs>
              <filter id="torn">
                <feTurbulence baseFrequency="0.04" numOctaves="2" result="noise"/>
                <feDisplacementMap in="SourceGraphic" in2="noise" scale="3"/>
              </filter>
            </defs>
            <rect width="100%" height="100%" fill="white" filter="url(#torn)"
                  rx="4" ry="4" stroke="none"/>
          </svg>
        `);

        image = image.composite([{
          input: tornMask,
          top: 0,
          left: 0,
          blend: 'dest-in'
        }]);

        // Add subtle shadow/depth effect for torn edges
        const shadowOverlay = Buffer.from(`
          <svg width="${totalWidth}" height="${totalHeight}">
            <rect width="100%" height="100%" fill="rgba(0,0,0,0.03)"
                  x="2" y="2"/>
          </svg>
        `);

        image = image.composite([{
          input: shadowOverlay,
          top: 0,
          left: 0,
          blend: 'multiply'
        }]);
      }
    } else {
      console.log('No border conditions met. Params:', {
        instaxStyle: params.instaxStyle,
        borderColor: params.borderColor,
        border_color: params.border_color,
        borderWidth: params.borderWidth,
        border_width: params.border_width
      });
    }

    // Add shadow effect
    if (params.shadow && intensity > 0.5) {
      console.log('Adding shadow effect');
      // Simple shadow simulation with slight blur and offset
      // This is a simplified version - more complex shadows would require composite operations
    }

    console.log('=== PAPER FILTER END ===');
    return image;
  }

  private async applyColorFilter(
    image: sharp.Sharp,
    params: FilterParameters,
    intensity: number
  ): Promise<sharp.Sharp> {
    const operations: any = {};

    // Base color adjustments
    if (params.brightness !== undefined) {
      const brightness = 1 + ((params.brightness - 1) * intensity);
      operations.brightness = brightness;
    }

    if (params.contrast !== undefined) {
      const contrast = 1 + ((params.contrast - 1) * intensity);
      operations.contrast = contrast;
    }

    if (params.saturation !== undefined) {
      const saturation = 1 + ((params.saturation - 1) * intensity);
      operations.saturation = saturation;
    }

    if (params.hue !== undefined) {
      const hue = params.hue * intensity;
      operations.hue = hue;
    }

    // Apply basic modulate operations
    if (Object.keys(operations).length > 0) {
      image = image.modulate(operations);
    }

    // Advanced color adjustments using curves (simulated with multiple operations)
    if (params.shadows !== undefined) {
      const shadowAdjust = params.shadows * intensity;
      if (shadowAdjust !== 0) {
        // Simulate shadow adjustment by modifying darker areas
        const adjustment = 1 + (shadowAdjust * 0.3);
        image = image.linear([adjustment, adjustment, adjustment], [0, 0, 0]);
      }
    }

    if (params.highlights !== undefined) {
      const highlightAdjust = params.highlights * intensity;
      if (highlightAdjust !== 0) {
        // Simulate highlight adjustment
        const adjustment = 1 + (highlightAdjust * 0.2);
        image = image.gamma(adjustment);
      }
    }

    // Clarity effect (simplified unsharp mask)
    if (params.clarity !== undefined && params.clarity > 0) {
      const clarityAmount = params.clarity * intensity;
      if (clarityAmount > 0.1) {
        image = image.sharpen({ sigma: 1.0, m1: 0.5, m2: clarityAmount });
      }
    }

    // Calculate combined tint effect to avoid multiple tint() calls
    let tintR = 255, tintG = 255, tintB = 255;
    let hasTintEffect = false;

    // Color boosts
    if (params.red_boost !== undefined && params.red_boost > 0) {
      const boost = params.red_boost * intensity;
      tintR += Math.round(boost * 30);
      hasTintEffect = true;
    }

    if (params.blue_boost !== undefined && params.blue_boost > 0) {
      const boost = params.blue_boost * intensity;
      tintB += Math.round(boost * 30);
      hasTintEffect = true;
    }

    if (params.green_boost !== undefined && params.green_boost > 0) {
      const boost = params.green_boost * intensity;
      tintG += Math.round(boost * 30);
      hasTintEffect = true;
    }

    if (params.orange_boost !== undefined && params.orange_boost > 0) {
      const boost = params.orange_boost * intensity;
      tintR += Math.round(boost * 20);
      tintG += Math.round(boost * 15);
      hasTintEffect = true;
    }

    // Temperature adjustment
    if (params.temperature !== undefined) {
      const temp = params.temperature * intensity;
      if (temp > 0) {
        // Warm - add red/yellow
        const warmth = Math.min(temp / 500, 1);
        tintR += Math.round(warmth * 15);
        tintG += Math.round(warmth * 8);
        tintB -= Math.round(warmth * 20);
        hasTintEffect = true;
      } else {
        // Cool - add blue
        const coolness = Math.min(Math.abs(temp) / 500, 1);
        tintR -= Math.round(coolness * 20);
        tintG -= Math.round(coolness * 8);
        tintB += Math.round(coolness * 15);
        hasTintEffect = true;
      }
    }

    // Tint effects
    if (params.yellow_tint !== undefined && params.yellow_tint > 0) {
      const tint = params.yellow_tint * intensity;
      tintR += Math.round(tint * 20);
      tintG += Math.round(tint * 20);
      hasTintEffect = true;
    }

    if (params.red_leak !== undefined && params.red_leak > 0) {
      const leak = params.red_leak * intensity;
      tintR += Math.round(leak * 30);
      tintB -= Math.round(leak * 15);
      hasTintEffect = true;
    }

    // Apply combined tint effect only once
    if (hasTintEffect) {
      // Clamp values to valid range
      tintR = Math.max(200, Math.min(300, tintR));
      tintG = Math.max(200, Math.min(300, tintG));
      tintB = Math.max(200, Math.min(300, tintB));

      console.log('Applying combined tint:', { r: tintR, g: tintG, b: tintB });
      image = image.tint({ r: tintR, g: tintG, b: tintB });
    }

    // Fade effect (reduces contrast and adds slight brightness)
    if (params.fade !== undefined && params.fade > 0) {
      const fadeAmount = params.fade * intensity;
      image = image.modulate({
        brightness: 1 + fadeAmount * 0.2,
        contrast: 1 - fadeAmount * 0.3
      });
    }

    // Soft light effect
    if (params.soft_light !== undefined && params.soft_light > 0) {
      const softness = params.soft_light * intensity;
      image = image.modulate({
        brightness: 1 + softness * 0.1,
        contrast: 1 - softness * 0.2
      });
    }

    // Sepia effect
    if (params.sepia !== undefined && params.sepia > 0) {
      const sepiaIntensity = params.sepia * intensity;
      if (sepiaIntensity > 0.1) {
        image = image.modulate({
          saturation: 1 - sepiaIntensity * 0.8,
          brightness: 1 + sepiaIntensity * 0.1
        }).tint({ r: 255, g: 240, b: 200 });
      }
    }

    return image;
  }

  private async applyCompositeFilter(
    image: sharp.Sharp,
    params: FilterParameters,
    intensity: number
  ): Promise<sharp.Sharp> {
    const metadata = await image.metadata();
    const { width = 1000, height = 1000 } = metadata;

    // Apply color effects first
    image = await this.applyColorFilter(image, params, intensity);

    // Vignette effect
    if (params.vignette !== undefined && params.vignette > 0) {
      const vignetteAmount = params.vignette * intensity;
      if (vignetteAmount > 0.1) {
        const centerX = Math.round(width / 2);
        const centerY = Math.round(height / 2);
        const radius = Math.min(width, height) * (0.8 - vignetteAmount * 0.3);

        // Create a radial gradient mask for vignette
        const vignetteOverlay = Buffer.from(`
          <svg width="${width}" height="${height}">
            <defs>
              <radialGradient id="vignette" cx="50%" cy="50%">
                <stop offset="0%" style="stop-color:white;stop-opacity:1" />
                <stop offset="60%" style="stop-color:white;stop-opacity:1" />
                <stop offset="100%" style="stop-color:black;stop-opacity:${vignetteAmount}" />
              </radialGradient>
            </defs>
            <rect width="100%" height="100%" fill="url(#vignette)" />
          </svg>
        `);

        image = image.composite([{
          input: vignetteOverlay,
          top: 0,
          left: 0,
          blend: 'multiply'
        }]);
      }
    }

    // Film grain effect
    if (params.grain !== undefined && params.grain > 0) {
      const grainAmount = params.grain * intensity;
      if (grainAmount > 0.1) {
        const grainOverlay = Buffer.from(`
          <svg width="${width}" height="${height}">
            <defs>
              <filter id="grain">
                <feTurbulence baseFrequency="${0.8 + grainAmount}" numOctaves="4" result="noise"/>
                <feColorMatrix in="noise" type="saturate" values="0"/>
                <feBlend mode="overlay" opacity="${grainAmount * 0.3}"/>
              </filter>
            </defs>
            <rect width="100%" height="100%" fill="white" filter="url(#grain)"/>
          </svg>
        `);

        image = image.composite([{
          input: grainOverlay,
          top: 0,
          left: 0,
          blend: 'overlay'
        }]);
      }
    }

    // Color shift effect (for artistic filters)
    if (params.color_shift !== undefined && params.color_shift > 0) {
      const shift = params.color_shift * intensity;
      // Simple color channel shift
      image = image.linear([1 + shift * 0.2, 1, 1 - shift * 0.1], [0, 0, 0]);
    }

    // Blue shadows effect
    if (params.blue_shadows !== undefined && params.blue_shadows > 0) {
      const blueAmount = params.blue_shadows * intensity;
      // Add blue tint to shadow areas (simplified)
      image = image.tint({ r: 255 - Math.round(blueAmount * 30), g: 255 - Math.round(blueAmount * 20), b: 255 + Math.round(blueAmount * 40) });
    }

    // Blur edges effect (toy camera style)
    if (params.blur_edges !== undefined && params.blur_edges > 0) {
      const blurAmount = params.blur_edges * intensity;
      if (blurAmount > 0.05) {
        // Create a mask that's sharp in center, blurred at edges
        const edgeMask = Buffer.from(`
          <svg width="${width}" height="${height}">
            <defs>
              <radialGradient id="sharpness" cx="50%" cy="50%">
                <stop offset="0%" style="stop-color:white;stop-opacity:1" />
                <stop offset="70%" style="stop-color:white;stop-opacity:1" />
                <stop offset="100%" style="stop-color:black;stop-opacity:1" />
              </radialGradient>
            </defs>
            <rect width="100%" height="100%" fill="url(#sharpness)" />
          </svg>
        `);

        // Apply slight overall blur for toy camera effect
        image = image.blur(blurAmount * 2);
      }
    }

    // Apply paper effects last (borders, frames)
    image = await this.applyPaperFilter(image, params, intensity);

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