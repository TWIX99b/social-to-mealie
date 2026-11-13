import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
    return {
        id: 'twix99b/social-to-mealie',
        name: 'Social → Mealie',
        categories: ['utilities', 'food-and-drink', 'recipe manager'],
        short_name: 'Social → Mealie',
        description: 'Recipes from reels, TikToks and posts – written by Claude, saved to Mealie.',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f5ece2',
        theme_color: '#a6441d',
        icons: [
            { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
            { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
            { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        "share_target": {
            "action": "/",
            "method": "GET",
            "params": {
                "title": "shared_title",
                "text": "shared_text",
                "url": "shared_url"
            }
        }
    }
}