import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'ActionPhase Documentation',
  description: 'Complete guide for players, GMs, and developers',
  base: '/docs/',
  ignoreDeadLinks: true,  // Allow dead links during development

  themeConfig: {
    nav: [
      { text: 'User Guide', link: '/user/' },
      { text: 'GM Guide', link: '/user/gm-guide/' },
      { text: 'Developer', link: '/developer/' },
      { text: 'API (Swagger)', link: 'javascript:window.open("/api/v1/docs/", "_blank")' }
    ],

    sidebar: {
      '/user/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Welcome', link: '/user/' },
            { text: 'Creating an Account', link: '/user/getting-started/creating-account' },
            { text: 'Joining a Game', link: '/user/getting-started/joining-game' },
            { text: 'Your First Character', link: '/user/getting-started/first-character' }
          ]
        },
        {
          text: 'Game Guide',
          items: [
            { text: 'Game Phases', link: '/user/game-guide/game-phases' },
            { text: 'Common Room', link: '/user/game-guide/common-room' },
            { text: 'Action Phase', link: '/user/game-guide/action-phase' },
            { text: 'Character Management', link: '/user/game-guide/character-management' },
            { text: 'Private Messages', link: '/user/game-guide/private-messages' }
          ]
        },
        {
          text: 'GM Guide',
          items: [
            { text: 'Getting Started', link: '/user/gm-guide/getting-started' },
            { text: 'Managing Players', link: '/user/gm-guide/managing-players' },
            { text: 'Character Approval', link: '/user/gm-guide/character-approval' },
            { text: 'Phase Management', link: '/user/gm-guide/phase-management' },
            { text: 'Running Games', link: '/user/gm-guide/running-games' },
            { text: 'Best Practices', link: '/user/gm-guide/best-practices' }
          ]
        },
        {
          text: 'Help',
          items: [
            { text: 'FAQ', link: '/user/faq' }
          ]
        }
      ],
      '/developer/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Developer Guide', link: '/developer/' },
            { text: 'Onboarding', link: '/developer/getting-started/onboarding' }
          ]
        },
        {
          text: 'Architecture',
          items: [
            { text: 'System Overview', link: '/developer/architecture/overview' },
            { text: 'Components', link: '/developer/architecture/components' },
            { text: 'ADRs', link: '/developer/architecture/adrs/' }
          ]
        },
        {
          text: 'API',
          items: [
            { text: 'API Reference', link: '/developer/api/reference' }
          ]
        },
        {
          text: 'Testing',
          items: [
            { text: 'Testing Guide', link: '/developer/testing/overview' }
          ]
        }
      ]
    },

    search: {
      provider: 'local'
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/yourusername/actionphase' }
    ],

    footer: {
      message: 'Released under the ISC License.',
      copyright: 'Copyright © 2025 ActionPhase'
    }
  }
})
