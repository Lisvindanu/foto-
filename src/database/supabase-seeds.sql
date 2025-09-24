-- Default filter categories
INSERT INTO filter_categories (name, display_name, description, sort_order) VALUES
('paper', 'Paper Types', 'Different paper textures and borders', 1),
('color', 'Color Effects', 'Color grading and vintage effects', 2),
('artistic', 'Artistic', 'Creative and artistic filters', 3),
('vintage', 'Vintage', 'Retro and classic film effects', 4)
ON CONFLICT (name) DO NOTHING;

-- Default filters
INSERT INTO filters (category_id, name, display_name, filter_type, parameters, description, css_class) VALUES
-- Paper filters
(1, 'classic_white', 'Classic White', 'paper',
 '{"border_width": 0.1, "border_color": "#ffffff", "shadow": true}',
 'Classic polaroid white border', 'filter-classic-white'),

(1, 'vintage_cream', 'Vintage Cream', 'paper',
 '{"border_width": 0.1, "border_color": "#f5f1e8", "texture": "vintage_paper.png"}',
 'Vintage cream colored paper', 'filter-vintage-cream'),

(1, 'black_border', 'Black Border', 'paper',
 '{"border_width": 0.05, "border_color": "#000000", "shadow": false}',
 'Modern black border style', 'filter-black-border'),

(1, 'instax_mini', 'Instax Mini', 'paper',
 '{"shadow": true, "texture": "paper_grain", "borderColor": "#ffffff", "borderWidth": 0.1, "instaxStyle": true}',
 'Instax Mini polaroid style', 'filter-instax-mini'),

-- Color filters
(2, 'original', 'Original', 'color',
 '{"saturation": 1.0, "brightness": 1.0, "contrast": 1.0}',
 'No filter applied', 'filter-original'),

(2, 'warm', 'Warm', 'color',
 '{"temperature": 200, "saturation": 1.1, "highlights": 0.1}',
 'Warm golden tone', 'filter-warm'),

(2, 'cool', 'Cool', 'color',
 '{"temperature": -150, "saturation": 0.9, "shadows": -0.1}',
 'Cool blue tone', 'filter-cool'),

(2, 'sepia', 'Sepia', 'color',
 '{"sepia": 0.8, "saturation": 0.3, "brightness": 1.1}',
 'Classic sepia tone', 'filter-sepia'),

(2, 'bw', 'Black & White', 'color',
 '{"saturation": 0, "contrast": 1.2, "brightness": 1.05}',
 'Monochrome black and white', 'filter-bw'),

-- Vintage filters
(4, 'faded', 'Faded', 'color',
 '{"saturation": 0.7, "contrast": 0.8, "brightness": 1.2, "vignette": 0.3}',
 'Faded vintage look', 'filter-faded'),

(4, 'retro', 'Retro', 'color',
 '{"saturation": 1.3, "contrast": 1.1, "hue_shift": 10, "grain": 0.2}',
 'Retro film effect', 'filter-retro')
ON CONFLICT (name) DO NOTHING;

-- Default app settings
INSERT INTO app_settings (key, value, data_type, description, is_public) VALUES
('max_file_size', '10485760', 'number', 'Maximum upload file size in bytes (10MB)', TRUE),
('allowed_mime_types', '["image/jpeg", "image/png", "image/webp"]', 'json', 'Allowed image formats', TRUE),
('max_photos_per_user', '100', 'number', 'Maximum photos per user', TRUE),
('image_quality', '85', 'number', 'JPEG compression quality (1-100)', TRUE),
('thumbnail_size', '300', 'number', 'Thumbnail max dimension in pixels', TRUE),
('session_duration', '2592000', 'number', 'Session duration in seconds (30 days)', FALSE),
('enable_geolocation', 'false', 'boolean', 'Enable location capture', TRUE),
('enable_analytics', 'false', 'boolean', 'Enable usage analytics', TRUE)
ON CONFLICT (key) DO NOTHING;