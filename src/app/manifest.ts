import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
    return {
        id: 'twix99b/social-to-mealie',
        name: 'Social → Mealie',
        categories: ['utilities', 'food-and-drink', 'recipe manager'],
        short_name: 'Social → Mealie',
        description: 'Rezepte aus Reels, TikToks und Posts – geschrieben von Claude, gespeichert in Mealie.',
        start_url: '/',
        lang: 'de',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f5ece2',
        theme_color: '#a6441d',
        icons: [
            {
                src: '/android-chrome-192x192.png',
                sizes: '192x192',
                type: 'image/png',
            },
            {
                src: '/android-chrome-512x512.png',
                sizes: '512x512',
                type: 'image/png',
            },
            {
                src: '/favicon-16x16.png',
                sizes: '16x16',
                type: 'image/png',
            },
            {
                src: '/favicon-32x32.png',
                sizes: '32x32',
                type: 'image/png',
            }
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