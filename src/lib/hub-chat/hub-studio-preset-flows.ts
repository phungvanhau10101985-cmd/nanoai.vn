import type { StudioGeneratorKind } from '@/lib/hub-chat/hub-studio-presets'

export type StudioStepPhase = 'discovery' | 'design'

export type StudioFlowStepDef = {
  key: string
  labelKey: string
  phase: StudioStepPhase
  generator?: StudioGeneratorKind
  /** Banner / ad: e.g. "1.91:1", "1:1", "9:16" */
  aspectRatio?: string
  /** Platform hint for prompts: google, facebook, instagram, shopee… */
  platform?: string
  formFactor?: 'mobile' | 'desktop' | 'square'
  /** First approved design asset becomes style anchor (e.g. story main character). */
  referenceAnchor?: boolean
}

export const MOBILE_SHOP_FLOW: StudioFlowStepDef[] = [
  { key: 'brand_name', labelKey: 'brand_name', phase: 'discovery' },
  { key: 'domain_name', labelKey: 'domain_name', phase: 'discovery' },
  { key: 'industry_product', labelKey: 'industry_product', phase: 'discovery' },
  { key: 'style_mood', labelKey: 'style_mood', phase: 'discovery' },
  { key: 'color_palette', labelKey: 'color_palette', phase: 'discovery' },
  { key: 'target_audience', labelKey: 'target_audience', phase: 'discovery' },
  { key: 'logo', labelKey: 'logo', phase: 'design', generator: 'logo', formFactor: 'square' },
  { key: 'home_mobile', labelKey: 'home_mobile', phase: 'design', generator: 'ui_mockup', formFactor: 'mobile' },
  { key: 'home_desktop', labelKey: 'home_desktop', phase: 'design', generator: 'ui_desktop', formFactor: 'desktop' },
  { key: 'product_detail_mobile', labelKey: 'product_detail_mobile', phase: 'design', generator: 'ui_mockup', formFactor: 'mobile' },
  { key: 'product_detail_desktop', labelKey: 'product_detail_desktop', phase: 'design', generator: 'ui_desktop', formFactor: 'desktop' },
  { key: 'cart_mobile', labelKey: 'cart_mobile', phase: 'design', generator: 'ui_mockup', formFactor: 'mobile' },
  { key: 'cart_desktop', labelKey: 'cart_desktop', phase: 'design', generator: 'ui_desktop', formFactor: 'desktop' },
  { key: 'category_mobile', labelKey: 'category_mobile', phase: 'design', generator: 'ui_mockup', formFactor: 'mobile' },
  { key: 'category_desktop', labelKey: 'category_desktop', phase: 'design', generator: 'ui_desktop', formFactor: 'desktop' },
  { key: 'product_list_mobile', labelKey: 'product_list_mobile', phase: 'design', generator: 'ui_mockup', formFactor: 'mobile' },
  { key: 'product_list_desktop', labelKey: 'product_list_desktop', phase: 'design', generator: 'ui_desktop', formFactor: 'desktop' },
  { key: 'search_results_mobile', labelKey: 'search_results_mobile', phase: 'design', generator: 'ui_mockup', formFactor: 'mobile' },
  { key: 'search_results_desktop', labelKey: 'search_results_desktop', phase: 'design', generator: 'ui_desktop', formFactor: 'desktop' },
  { key: 'checkout_mobile', labelKey: 'checkout_mobile', phase: 'design', generator: 'ui_mockup', formFactor: 'mobile' },
  { key: 'checkout_desktop', labelKey: 'checkout_desktop', phase: 'design', generator: 'ui_desktop', formFactor: 'desktop' },
  { key: 'order_success_mobile', labelKey: 'order_success_mobile', phase: 'design', generator: 'ui_mockup', formFactor: 'mobile' },
  { key: 'order_success_desktop', labelKey: 'order_success_desktop', phase: 'design', generator: 'ui_desktop', formFactor: 'desktop' },
  { key: 'login_mobile', labelKey: 'login_mobile', phase: 'design', generator: 'ui_mockup', formFactor: 'mobile' },
  { key: 'login_desktop', labelKey: 'login_desktop', phase: 'design', generator: 'ui_desktop', formFactor: 'desktop' },
  { key: 'profile_mobile', labelKey: 'profile_mobile', phase: 'design', generator: 'ui_mockup', formFactor: 'mobile' },
  { key: 'profile_desktop', labelKey: 'profile_desktop', phase: 'design', generator: 'ui_desktop', formFactor: 'desktop' },
  { key: 'order_detail_mobile', labelKey: 'order_detail_mobile', phase: 'design', generator: 'ui_mockup', formFactor: 'mobile' },
  { key: 'order_detail_desktop', labelKey: 'order_detail_desktop', phase: 'design', generator: 'ui_desktop', formFactor: 'desktop' },
  { key: 'wishlist_mobile', labelKey: 'wishlist_mobile', phase: 'design', generator: 'ui_mockup', formFactor: 'mobile' },
  { key: 'wishlist_desktop', labelKey: 'wishlist_desktop', phase: 'design', generator: 'ui_desktop', formFactor: 'desktop' },
  { key: 'about_mobile', labelKey: 'about_mobile', phase: 'design', generator: 'ui_mockup', formFactor: 'mobile' },
  { key: 'about_desktop', labelKey: 'about_desktop', phase: 'design', generator: 'ui_desktop', formFactor: 'desktop' },
  { key: 'contact_mobile', labelKey: 'contact_mobile', phase: 'design', generator: 'ui_mockup', formFactor: 'mobile' },
  { key: 'contact_desktop', labelKey: 'contact_desktop', phase: 'design', generator: 'ui_desktop', formFactor: 'desktop' },
  { key: 'policy_mobile', labelKey: 'policy_mobile', phase: 'design', generator: 'ui_mockup', formFactor: 'mobile' },
  { key: 'policy_desktop', labelKey: 'policy_desktop', phase: 'design', generator: 'ui_desktop', formFactor: 'desktop' },
]

export const SALE_BANNER_FLOW: StudioFlowStepDef[] = [
  { key: 'campaign_name', labelKey: 'campaign_name', phase: 'discovery' },
  { key: 'product_offer', labelKey: 'product_offer', phase: 'discovery' },
  { key: 'discount_cta', labelKey: 'discount_cta', phase: 'discovery' },
  { key: 'brand_style', labelKey: 'brand_style', phase: 'discovery' },
  { key: 'color_tone', labelKey: 'color_tone', phase: 'discovery' },
  { key: 'ad_platforms', labelKey: 'ad_platforms', phase: 'discovery' },
  {
    key: 'google_display',
    labelKey: 'google_display',
    phase: 'design',
    generator: 'banner',
    aspectRatio: '1.91:1',
    platform: 'google',
    formFactor: 'desktop',
  },
  {
    key: 'google_square',
    labelKey: 'google_square',
    phase: 'design',
    generator: 'banner',
    aspectRatio: '1:1',
    platform: 'google',
    formFactor: 'square',
  },
  {
    key: 'facebook_feed',
    labelKey: 'facebook_feed',
    phase: 'design',
    generator: 'banner',
    aspectRatio: '1:1',
    platform: 'facebook',
    formFactor: 'square',
  },
  {
    key: 'facebook_story',
    labelKey: 'facebook_story',
    phase: 'design',
    generator: 'banner',
    aspectRatio: '9:16',
    platform: 'facebook',
    formFactor: 'mobile',
  },
  {
    key: 'instagram_reels',
    labelKey: 'instagram_reels',
    phase: 'design',
    generator: 'banner',
    aspectRatio: '9:16',
    platform: 'instagram',
    formFactor: 'mobile',
  },
]

export const BRAND_KIT_FLOW: StudioFlowStepDef[] = [
  { key: 'brand_name', labelKey: 'brand_name', phase: 'discovery' },
  { key: 'industry', labelKey: 'industry', phase: 'discovery' },
  { key: 'style_mood', labelKey: 'style_mood', phase: 'discovery' },
  { key: 'color_palette', labelKey: 'color_palette', phase: 'discovery' },
  { key: 'tagline', labelKey: 'tagline', phase: 'discovery' },
  { key: 'logo_primary', labelKey: 'logo_primary', phase: 'design', generator: 'logo', formFactor: 'square' },
  { key: 'logo_icon', labelKey: 'logo_icon', phase: 'design', generator: 'logo', formFactor: 'square' },
  { key: 'banner_web', labelKey: 'banner_web', phase: 'design', generator: 'banner', aspectRatio: '16:9', formFactor: 'desktop' },
  { key: 'banner_social', labelKey: 'banner_social', phase: 'design', generator: 'banner', aspectRatio: '1:1', formFactor: 'square' },
  { key: 'product_label', labelKey: 'product_label', phase: 'design', generator: 'banner', aspectRatio: '1:1', formFactor: 'square' },
  { key: 'sticker', labelKey: 'sticker', phase: 'design', generator: 'logo', formFactor: 'square' },
  { key: 'biz_card', labelKey: 'biz_card', phase: 'design', generator: 'banner', aspectRatio: '16:9', formFactor: 'desktop' },
]

export const LANDING_PAGE_FLOW: StudioFlowStepDef[] = [
  { key: 'product_name', labelKey: 'product_name', phase: 'discovery' },
  { key: 'value_prop', labelKey: 'value_prop', phase: 'discovery' },
  { key: 'target_audience', labelKey: 'target_audience', phase: 'discovery' },
  { key: 'style_mood', labelKey: 'style_mood', phase: 'discovery' },
  { key: 'color_palette', labelKey: 'color_palette', phase: 'discovery' },
  { key: 'hero_desktop', labelKey: 'hero_desktop', phase: 'design', generator: 'banner', aspectRatio: '16:9', formFactor: 'desktop' },
  { key: 'hero_mobile', labelKey: 'hero_mobile', phase: 'design', generator: 'ui_mockup', formFactor: 'mobile' },
  { key: 'features', labelKey: 'features', phase: 'design', generator: 'banner', aspectRatio: '16:9', formFactor: 'desktop' },
  { key: 'pricing', labelKey: 'pricing', phase: 'design', generator: 'ui_mockup', formFactor: 'mobile' },
  { key: 'testimonials', labelKey: 'testimonials', phase: 'design', generator: 'banner', aspectRatio: '16:9', formFactor: 'desktop' },
  { key: 'faq', labelKey: 'faq', phase: 'design', generator: 'ui_mockup', formFactor: 'mobile' },
  { key: 'cta_footer', labelKey: 'cta_footer', phase: 'design', generator: 'banner', aspectRatio: '16:9', formFactor: 'desktop' },
]

export const PRODUCT_LISTING_FLOW: StudioFlowStepDef[] = [
  { key: 'product_name', labelKey: 'product_name', phase: 'discovery' },
  { key: 'category', labelKey: 'category', phase: 'discovery' },
  { key: 'marketplace', labelKey: 'marketplace', phase: 'discovery' },
  { key: 'selling_points', labelKey: 'selling_points', phase: 'discovery' },
  { key: 'photo_style', labelKey: 'photo_style', phase: 'discovery' },
  { key: 'product_white', labelKey: 'product_white', phase: 'design', generator: 'product_photo', aspectRatio: '1:1', formFactor: 'square' },
  { key: 'product_lifestyle', labelKey: 'product_lifestyle', phase: 'design', generator: 'product_photo', aspectRatio: '1:1', formFactor: 'square' },
  { key: 'product_detail', labelKey: 'product_detail', phase: 'design', generator: 'product_photo', aspectRatio: '1:1', formFactor: 'square' },
  { key: 'promo_banner_sq', labelKey: 'promo_banner_sq', phase: 'design', generator: 'banner', aspectRatio: '1:1', platform: 'shopee', formFactor: 'square' },
  { key: 'promo_banner_story', labelKey: 'promo_banner_story', phase: 'design', generator: 'banner', aspectRatio: '9:16', platform: 'tiktok', formFactor: 'mobile' },
]

export const WEDDING_INVITE_FLOW: StudioFlowStepDef[] = [
  { key: 'event_type', labelKey: 'event_type', phase: 'discovery' },
  { key: 'host_names', labelKey: 'host_names', phase: 'discovery' },
  { key: 'date_venue', labelKey: 'date_venue', phase: 'discovery' },
  { key: 'style_mood', labelKey: 'style_mood', phase: 'discovery' },
  { key: 'color_palette', labelKey: 'color_palette', phase: 'discovery' },
  { key: 'cover', labelKey: 'cover', phase: 'design', generator: 'invitation', aspectRatio: '9:16', formFactor: 'mobile' },
  { key: 'inside_spread', labelKey: 'inside_spread', phase: 'design', generator: 'invitation', aspectRatio: '16:9', formFactor: 'desktop' },
  { key: 'rsvp_card', labelKey: 'rsvp_card', phase: 'design', generator: 'invitation', aspectRatio: '1:1', formFactor: 'square' },
  { key: 'envelope', labelKey: 'envelope', phase: 'design', generator: 'invitation', aspectRatio: '16:9', formFactor: 'desktop' },
  { key: 'story_share', labelKey: 'story_share', phase: 'design', generator: 'invitation', aspectRatio: '9:16', formFactor: 'mobile' },
]

export const AD_MUSIC_FLOW: StudioFlowStepDef[] = [
  { key: 'brand_product', labelKey: 'brand_product', phase: 'discovery' },
  { key: 'mood_feel', labelKey: 'mood_feel', phase: 'discovery' },
  { key: 'tempo', labelKey: 'tempo', phase: 'discovery' },
  { key: 'instruments', labelKey: 'instruments', phase: 'discovery' },
  { key: 'ad_platform', labelKey: 'ad_platform', phase: 'discovery' },
  { key: 'duration_feel', labelKey: 'duration_feel', phase: 'discovery' },
  { key: 'track_main', labelKey: 'track_main', phase: 'design', generator: 'lyria_music' },
  { key: 'track_short', labelKey: 'track_short', phase: 'design', generator: 'lyria_music' },
  { key: 'track_alt', labelKey: 'track_alt', phase: 'design', generator: 'lyria_music' },
]

export const LOOKBOOK_FLOW: StudioFlowStepDef[] = [
  { key: 'collection_name', labelKey: 'collection_name', phase: 'discovery' },
  { key: 'season_theme', labelKey: 'season_theme', phase: 'discovery' },
  { key: 'style_mood', labelKey: 'style_mood', phase: 'discovery' },
  { key: 'color_palette', labelKey: 'color_palette', phase: 'discovery' },
  { key: 'model_vibe', labelKey: 'model_vibe', phase: 'discovery' },
  { key: 'hero_look', labelKey: 'hero_look', phase: 'design', generator: 'banner', aspectRatio: '16:9', formFactor: 'desktop' },
  { key: 'grid_look', labelKey: 'grid_look', phase: 'design', generator: 'banner', aspectRatio: '1:1', formFactor: 'square' },
  { key: 'look_detail_1', labelKey: 'look_detail_1', phase: 'design', generator: 'product_photo', aspectRatio: '9:16', formFactor: 'mobile' },
  { key: 'look_detail_2', labelKey: 'look_detail_2', phase: 'design', generator: 'product_photo', aspectRatio: '9:16', formFactor: 'mobile' },
  { key: 'catalog_cover', labelKey: 'catalog_cover', phase: 'design', generator: 'banner', aspectRatio: '9:16', formFactor: 'mobile' },
]

export const PACKAGING_KIT_FLOW: StudioFlowStepDef[] = [
  { key: 'brand_name', labelKey: 'brand_name', phase: 'discovery' },
  { key: 'product_type', labelKey: 'product_type', phase: 'discovery' },
  { key: 'box_size', labelKey: 'box_size', phase: 'discovery' },
  { key: 'box_face_confirm', labelKey: 'box_face_confirm', phase: 'discovery' },
  { key: 'style_mood', labelKey: 'style_mood', phase: 'discovery' },
  { key: 'color_palette', labelKey: 'color_palette', phase: 'discovery' },
  { key: 'face_print_style', labelKey: 'face_print_style', phase: 'discovery' },
  { key: 'logo', labelKey: 'logo', phase: 'design', generator: 'logo', formFactor: 'square' },
  { key: 'face_top', labelKey: 'face_top', phase: 'design', generator: 'packaging_face', formFactor: 'square' },
  { key: 'face_front', labelKey: 'face_front', phase: 'design', generator: 'packaging_face', formFactor: 'square' },
  { key: 'face_right', labelKey: 'face_right', phase: 'design', generator: 'packaging_face', formFactor: 'square' },
  { key: 'face_bottom', labelKey: 'face_bottom', phase: 'design', generator: 'packaging_face', formFactor: 'square' },
  { key: 'face_back', labelKey: 'face_back', phase: 'design', generator: 'packaging_face', formFactor: 'square' },
  { key: 'face_left', labelKey: 'face_left', phase: 'design', generator: 'packaging_face', formFactor: 'square' },
  { key: 'box_mockup_3d', labelKey: 'box_mockup_3d', phase: 'design', generator: 'packaging_mockup', aspectRatio: '1:1', formFactor: 'square' },
  { key: 'box_dieline_pdf', labelKey: 'box_dieline_pdf', phase: 'design', generator: 'dieline_pdf', formFactor: 'desktop' },
  { key: 'product_label', labelKey: 'product_label', phase: 'design', generator: 'packaging', aspectRatio: '1:1', formFactor: 'square' },
  { key: 'seal_sticker', labelKey: 'seal_sticker', phase: 'design', generator: 'packaging', aspectRatio: '1:1', formFactor: 'square' },
  { key: 'barcode_label', labelKey: 'barcode_label', phase: 'design', generator: 'barcode', formFactor: 'square' },
]

/** Bước cũ chỉ dùng để tiếp tục các phiên packaging_kit đã lưu trước flow 6 mặt. */
const LEGACY_PACKAGING_STEPS: StudioFlowStepDef[] = [
  { key: 'box_flat', labelKey: 'box_flat', phase: 'design', generator: 'packaging', aspectRatio: '1:1', formFactor: 'square' },
  { key: 'face_lxw', labelKey: 'face_lxw', phase: 'design', generator: 'packaging_face', formFactor: 'square' },
  { key: 'face_lxh', labelKey: 'face_lxh', phase: 'design', generator: 'packaging_face', formFactor: 'square' },
  { key: 'face_wxh', labelKey: 'face_wxh', phase: 'design', generator: 'packaging_face', formFactor: 'square' },
  { key: 'body_strip', labelKey: 'body_strip', phase: 'design', generator: 'packaging_face', formFactor: 'desktop' },
]

export const INTERIOR_DESIGN_FLOW: StudioFlowStepDef[] = [
  { key: 'space_type', labelKey: 'space_type', phase: 'discovery' },
  { key: 'area_size', labelKey: 'area_size', phase: 'discovery' },
  { key: 'style_mood', labelKey: 'style_mood', phase: 'discovery' },
  { key: 'color_palette', labelKey: 'color_palette', phase: 'discovery' },
  { key: 'budget_tier', labelKey: 'budget_tier', phase: 'discovery' },
  { key: 'living_room', labelKey: 'living_room', phase: 'design', generator: 'interior', aspectRatio: '16:9', formFactor: 'desktop' },
  { key: 'kitchen', labelKey: 'kitchen', phase: 'design', generator: 'interior', aspectRatio: '16:9', formFactor: 'desktop' },
  { key: 'bedroom', labelKey: 'bedroom', phase: 'design', generator: 'interior', aspectRatio: '16:9', formFactor: 'desktop' },
  { key: 'facade', labelKey: 'facade', phase: 'design', generator: 'interior', aspectRatio: '16:9', formFactor: 'desktop' },
]

export const SOCIAL_MEDIA_KIT_FLOW: StudioFlowStepDef[] = [
  { key: 'brand_name', labelKey: 'brand_name', phase: 'discovery' },
  { key: 'content_theme', labelKey: 'content_theme', phase: 'discovery' },
  { key: 'tone_voice', labelKey: 'tone_voice', phase: 'discovery' },
  { key: 'color_palette', labelKey: 'color_palette', phase: 'discovery' },
  { key: 'platforms', labelKey: 'platforms', phase: 'discovery' },
  { key: 'logo_avatar', labelKey: 'logo_avatar', phase: 'design', generator: 'logo', formFactor: 'square' },
  { key: 'post_square', labelKey: 'post_square', phase: 'design', generator: 'banner', aspectRatio: '1:1', formFactor: 'square' },
  { key: 'story_916', labelKey: 'story_916', phase: 'design', generator: 'banner', aspectRatio: '9:16', formFactor: 'mobile' },
  { key: 'facebook_cover', labelKey: 'facebook_cover', phase: 'design', generator: 'banner', aspectRatio: '16:9', formFactor: 'desktop' },
  { key: 'pinterest_pin', labelKey: 'pinterest_pin', phase: 'design', generator: 'banner', aspectRatio: '9:16', formFactor: 'mobile' },
]

export const STORY_WITH_IMAGES_FLOW: StudioFlowStepDef[] = [
  { key: 'story_title', labelKey: 'story_title', phase: 'discovery' },
  { key: 'audience_age', labelKey: 'audience_age', phase: 'discovery' },
  { key: 'plot_summary', labelKey: 'plot_summary', phase: 'discovery' },
  { key: 'style_mood', labelKey: 'style_mood', phase: 'discovery' },
  { key: 'color_palette', labelKey: 'color_palette', phase: 'discovery' },
  {
    key: 'main_character',
    labelKey: 'main_character',
    phase: 'design',
    generator: 'story_panel',
    referenceAnchor: true,
    aspectRatio: '1:1',
    formFactor: 'square',
  },
  { key: 'page_1', labelKey: 'page_1', phase: 'design', generator: 'story_panel', aspectRatio: '16:9', formFactor: 'desktop' },
  { key: 'page_2', labelKey: 'page_2', phase: 'design', generator: 'story_panel', aspectRatio: '16:9', formFactor: 'desktop' },
  { key: 'page_3', labelKey: 'page_3', phase: 'design', generator: 'story_panel', aspectRatio: '16:9', formFactor: 'desktop' },
  { key: 'page_4', labelKey: 'page_4', phase: 'design', generator: 'story_panel', aspectRatio: '16:9', formFactor: 'desktop' },
  { key: 'cover', labelKey: 'cover', phase: 'design', generator: 'story_panel', aspectRatio: '9:16', formFactor: 'mobile' },
]

export const INFOGRAPHIC_SERIES_FLOW: StudioFlowStepDef[] = [
  { key: 'topic_focus', labelKey: 'topic_focus', phase: 'discovery' },
  { key: 'audience', labelKey: 'audience', phase: 'discovery' },
  { key: 'visual_style', labelKey: 'visual_style', phase: 'discovery' },
  { key: 'color_palette', labelKey: 'color_palette', phase: 'discovery' },
  { key: 'slide_hook', labelKey: 'slide_hook', phase: 'design', generator: 'infographic', aspectRatio: '16:9', formFactor: 'desktop' },
  { key: 'slide_2', labelKey: 'slide_2', phase: 'design', generator: 'infographic', aspectRatio: '16:9', formFactor: 'desktop' },
  { key: 'slide_3', labelKey: 'slide_3', phase: 'design', generator: 'infographic', aspectRatio: '16:9', formFactor: 'desktop' },
  { key: 'slide_4', labelKey: 'slide_4', phase: 'design', generator: 'infographic', aspectRatio: '16:9', formFactor: 'desktop' },
  { key: 'slide_summary', labelKey: 'slide_summary', phase: 'design', generator: 'infographic', aspectRatio: '16:9', formFactor: 'desktop' },
]

export const FASHION_CAMPAIGN_FLOW: StudioFlowStepDef[] = [
  { key: 'collection_name', labelKey: 'collection_name', phase: 'discovery' },
  { key: 'season_theme', labelKey: 'season_theme', phase: 'discovery' },
  { key: 'style_mood', labelKey: 'style_mood', phase: 'discovery' },
  { key: 'color_palette', labelKey: 'color_palette', phase: 'discovery' },
  { key: 'target_channel', labelKey: 'target_channel', phase: 'discovery' },
  { key: 'hero_look', labelKey: 'hero_look', phase: 'design', generator: 'banner', aspectRatio: '16:9', formFactor: 'desktop' },
  { key: 'outfit_try_1', labelKey: 'outfit_try_1', phase: 'design', generator: 'product_photo', aspectRatio: '9:16', formFactor: 'mobile' },
  { key: 'outfit_try_2', labelKey: 'outfit_try_2', phase: 'design', generator: 'product_photo', aspectRatio: '9:16', formFactor: 'mobile' },
  { key: 'sale_banner', labelKey: 'sale_banner', phase: 'design', generator: 'banner', aspectRatio: '1:1', formFactor: 'square' },
]

export const PROFILE_PHOTO_PACK_FLOW: StudioFlowStepDef[] = [
  { key: 'profession', labelKey: 'profession', phase: 'discovery' },
  { key: 'tone_formal', labelKey: 'tone_formal', phase: 'discovery' },
  { key: 'color_palette', labelKey: 'color_palette', phase: 'discovery' },
  { key: 'id_white', labelKey: 'id_white', phase: 'design', generator: 'portrait', aspectRatio: '3:4', formFactor: 'mobile' },
  { key: 'id_blue', labelKey: 'id_blue', phase: 'design', generator: 'portrait', aspectRatio: '3:4', formFactor: 'mobile' },
  { key: 'linkedin_profile', labelKey: 'linkedin_profile', phase: 'design', generator: 'portrait', aspectRatio: '1:1', formFactor: 'square' },
  { key: 'personal_banner', labelKey: 'personal_banner', phase: 'design', generator: 'banner', aspectRatio: '16:9', formFactor: 'desktop' },
]

export const PRESET_FLOW_MAP: Record<string, StudioFlowStepDef[]> = {
  mobile_shop: MOBILE_SHOP_FLOW,
  sale_banner: SALE_BANNER_FLOW,
  brand_kit: BRAND_KIT_FLOW,
  landing_page: LANDING_PAGE_FLOW,
  product_listing: PRODUCT_LISTING_FLOW,
  wedding_invite: WEDDING_INVITE_FLOW,
  ad_music: AD_MUSIC_FLOW,
  lookbook: LOOKBOOK_FLOW,
  packaging_kit: PACKAGING_KIT_FLOW,
  interior_design: INTERIOR_DESIGN_FLOW,
  social_media_kit: SOCIAL_MEDIA_KIT_FLOW,
  story_with_images: STORY_WITH_IMAGES_FLOW,
  infographic_series: INFOGRAPHIC_SERIES_FLOW,
  fashion_campaign: FASHION_CAMPAIGN_FLOW,
  profile_photo_pack: PROFILE_PHOTO_PACK_FLOW,
}

export function getFlowSteps(presetId: string): StudioFlowStepDef[] {
  return PRESET_FLOW_MAP[presetId] ?? []
}

export function isDiscoveryStep(presetId: string, stepKey: string): boolean {
  const step = getFlowSteps(presetId).find((s) => s.key === stepKey)
  return step?.phase === 'discovery'
}

export function getFlowStep(presetId: string, stepKey: string): StudioFlowStepDef | undefined {
  return (
    getFlowSteps(presetId).find((s) => s.key === stepKey) ??
    (presetId === 'packaging_kit' ? LEGACY_PACKAGING_STEPS.find((s) => s.key === stepKey) : undefined)
  )
}

export function allDiscoveryDone(presetId: string, steps: { key: string; status: string }[]): boolean {
  const discoveryKeys = getFlowSteps(presetId).filter((s) => s.phase === 'discovery').map((s) => s.key)
  return discoveryKeys.every((k) => steps.find((s) => s.key === k)?.status === 'done')
}

/** First style anchor: logo step, or referenceAnchor design step (e.g. story main character). */
export function getPrimaryLogoStepKey(presetId: string): string | null {
  const flow = getFlowSteps(presetId)
  const logo = flow.find((s) => s.phase === 'design' && s.generator === 'logo')
  if (logo) return logo.key
  const anchor = flow.find((s) => s.phase === 'design' && s.referenceAnchor)
  return anchor?.key ?? null
}

export function isLogoDesignStep(presetId: string, stepKey: string): boolean {
  const step = getFlowStep(presetId, stepKey)
  return step?.phase === 'design' && step.generator === 'logo'
}

/** Brief context for generation — logo step uses discovery + logo only; other steps use flow up to target. */
export function briefNotesForStepGeneration(
  presetId: string,
  stepKey: string,
  briefNotes: Record<string, string>
): Record<string, string> {
  const flow = getFlowSteps(presetId)
  const targetIdx = flow.findIndex((s) => s.key === stepKey)
  if (targetIdx < 0) return {}

  const logoKey = getPrimaryLogoStepKey(presetId)
  const out: Record<string, string> = {}

  for (const [key, value] of Object.entries(briefNotes)) {
    const trimmed = value?.trim()
    if (!trimmed) continue
    const idx = flow.findIndex((s) => s.key === key)
    if (idx < 0 || idx > targetIdx) continue
    if (logoKey && stepKey === logoKey) {
      const step = flow[idx]
      if (step?.phase !== 'discovery' && key !== logoKey) continue
    }
    out[key] = trimmed
  }
  return out
}

export function isStepAfterPrimaryLogo(presetId: string, stepKey: string): boolean {
  const logoKey = getPrimaryLogoStepKey(presetId)
  if (!logoKey) return false
  const flow = getFlowSteps(presetId)
  const logoIdx = flow.findIndex((s) => s.key === logoKey)
  const stepIdx = flow.findIndex((s) => s.key === stepKey)
  return stepIdx > logoIdx
}

export function primaryLogoApproved(
  steps: { key: string; status: string }[],
  presetId: string
): boolean {
  const logoKey = getPrimaryLogoStepKey(presetId)
  if (!logoKey) return true
  return steps.find((s) => s.key === logoKey)?.status === 'done'
}

export function hasPrimaryLogoReference(
  referenceImages: { screenKey: string }[],
  presetId: string
): boolean {
  const logoKey = getPrimaryLogoStepKey(presetId)
  if (!logoKey) return true
  return referenceImages.some((r) => r.screenKey === logoKey)
}

export function orderedReferenceUrls(
  referenceImages: { screenKey: string; url: string }[],
  presetId: string
): string[] {
  const logoKey = getPrimaryLogoStepKey(presetId)
  if (!logoKey) return referenceImages.map((r) => r.url)
  const logoRef = referenceImages.find((r) => r.screenKey === logoKey)
  const rest = referenceImages.filter((r) => r.screenKey !== logoKey)
  return [...(logoRef ? [logoRef.url] : []), ...rest.map((r) => r.url)]
}
