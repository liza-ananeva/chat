const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const path = require('path');

module.exports = {
    entry: './src/js/main.js',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'bundle.js'
    },
    module: {
        rules: [
            {
                test: /\.hbs$/,
                loader: 'handlebars-loader'
            },
            {
                test: /\.s[ac]ss$/i,
                use: [
                    process.env.NODE_ENV !== 'production'
                        ? 'style-loader'
                        : MiniCssExtractPlugin.loader,
                    'css-loader',
                    'sass-loader'
                ]
            },
            {
                test: /\.(png|jpe?g|gif)$/i,
                loader: 'file-loader'
            },
            {
                test: /\.ttf$/,
                loader: 'file-loader?name=./src/assets/fonts/[name].[ext]'
            },
            {
                test: /\.svg/,
                loader: 'svg-url-loader'
            }
        ]
    },
    devServer: {
        open: true
    },
    plugins: [
        new HtmlWebpackPlugin({
            filename: 'index.html',
            template: 'src/index.hbs'
        }),
        new MiniCssExtractPlugin({
            filename: '[name].css'
        })
    ],
    mode: process.env.NODE_ENV ? process.env.NODE_ENV : 'development'
};