const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.blockList = [
  /.*[/\\]src[/\\]services[/\\]wrapScheduler\.js$/,
  /.*[/\\]src[/\\]models[/\\].*$/,
  /.*[/\\]src[/\\]middleware[/\\].*$/,
  /.*[/\\]src[/\\]routes[/\\].*$/,
  /.*[/\\]src[/\\]server\.js$/,
];

module.exports = config;