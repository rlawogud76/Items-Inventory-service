#!/usr/bin/env node

/**
 * MCP Server for Discord Bot Monitoring
 * Allows Kiro to monitor Discord bot status, messages, and interactions
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Client, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

// Discord client setup
const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Store recent events
const recentEvents = [];
const MAX_EVENTS = 50;

function addEvent(type, data) {
  recentEvents.unshift({
    timestamp: new Date().toISOString(),
    type,
    data
  });
  if (recentEvents.length > MAX_EVENTS) {
    recentEvents.pop();
  }
}

// Discord event listeners
discordClient.on('ready', () => {
  console.log(`✅ Discord bot logged in as ${discordClient.user.tag}`);
  addEvent('bot_ready', {
    username: discordClient.user.tag,
    id: discordClient.user.id
  });
});

discordClient.on('interactionCreate', (interaction) => {
  addEvent('interaction', {
    type: interaction.type,
    customId: interaction.customId || 'N/A',
    user: interaction.user.tag,
    channelId: interaction.channelId,
    guildId: interaction.guildId
  });
});

discordClient.on('messageCreate', (message) => {
  if (message.author.bot) return;
  addEvent('message', {
    content: message.content.substring(0, 100),
    author: message.author.tag,
    channelId: message.channelId,
    guildId: message.guildId
  });
});

discordClient.on('error', (error) => {
  addEvent('error', {
    message: error.message,
    stack: error.stack
  });
});

// MCP Server setup
const server = new Server(
  {
    name: 'discord-bot-monitor',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {}
    },
  }
);

// Tool: Get bot status
server.setRequestHandler('tools/list', async () => {
  return {
    tools: [
      {
        name: 'get_bot_status',
        description: 'Get current Discord bot status (online, guilds, users)',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'get_recent_events',
        description: 'Get recent Discord events (interactions, messages, errors)',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Number of events to retrieve (max 50)',
              default: 10
            },
            type: {
              type: 'string',
              description: 'Filter by event type (interaction, message, error, bot_ready)',
              enum: ['interaction', 'message', 'error', 'bot_ready', 'all']
            }
          },
          required: []
        }
      },
      {
        name: 'get_guild_info',
        description: 'Get information about a specific Discord guild/server',
        inputSchema: {
          type: 'object',
          properties: {
            guildId: {
              type: 'string',
              description: 'Discord guild ID'
            }
          },
          required: ['guildId']
        }
      },
      {
        name: 'get_channel_messages',
        description: 'Get recent messages from a Discord channel',
        inputSchema: {
          type: 'object',
          properties: {
            channelId: {
              type: 'string',
              description: 'Discord channel ID'
            },
            limit: {
              type: 'number',
              description: 'Number of messages to retrieve (max 100)',
              default: 10
            }
          },
          required: ['channelId']
        }
      }
    ]
  };
});

server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'get_bot_status': {
        if (!discordClient.isReady()) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                status: 'offline',
                message: 'Bot is not connected to Discord'
              }, null, 2)
            }]
          };
        }

        const guilds = discordClient.guilds.cache.map(g => ({
          id: g.id,
          name: g.name,
          memberCount: g.memberCount
        }));

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              status: 'online',
              username: discordClient.user.tag,
              id: discordClient.user.id,
              guilds: guilds,
              totalGuilds: guilds.length,
              uptime: process.uptime(),
              ping: discordClient.ws.ping
            }, null, 2)
          }]
        };
      }

      case 'get_recent_events': {
        const limit = Math.min(args.limit || 10, 50);
        const type = args.type || 'all';
        
        let filtered = recentEvents;
        if (type !== 'all') {
          filtered = recentEvents.filter(e => e.type === type);
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              events: filtered.slice(0, limit),
              total: filtered.length
            }, null, 2)
          }]
        };
      }

      case 'get_guild_info': {
        const guild = discordClient.guilds.cache.get(args.guildId);
        if (!guild) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ error: 'Guild not found' }, null, 2)
            }],
            isError: true
          };
        }

        const channels = guild.channels.cache.map(c => ({
          id: c.id,
          name: c.name,
          type: c.type
        }));

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              id: guild.id,
              name: guild.name,
              memberCount: guild.memberCount,
              channels: channels,
              ownerId: guild.ownerId,
              createdAt: guild.createdAt
            }, null, 2)
          }]
        };
      }

      case 'get_channel_messages': {
        const channel = discordClient.channels.cache.get(args.channelId);
        if (!channel || !channel.isTextBased()) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ error: 'Channel not found or not text-based' }, null, 2)
            }],
            isError: true
          };
        }

        const limit = Math.min(args.limit || 10, 100);
        const messages = await channel.messages.fetch({ limit });
        
        const messageData = messages.map(m => ({
          id: m.id,
          content: m.content,
          author: m.author.tag,
          timestamp: m.createdAt,
          embeds: m.embeds.length,
          attachments: m.attachments.size
        }));

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              channelName: channel.name,
              messages: messageData
            }, null, 2)
          }]
        };
      }

      default:
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ error: 'Unknown tool' }, null, 2)
          }],
          isError: true
        };
    }
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: error.message,
          stack: error.stack
        }, null, 2)
      }],
      isError: true
    };
  }
});

// Start server
async function main() {
  // Connect to Discord
  await discordClient.login(process.env.DISCORD_TOKEN);
  
  // Start MCP server
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error('🚀 Discord Monitor MCP Server running');
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
