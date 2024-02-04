#!/bin/bash
###
 # @Author: Vincent Young
 # @Date: 2024-02-04 18:14:52
 # @LastEditors: Vincent Young
 # @LastEditTime: 2024-02-04 18:16:17
 # @FilePath: /bob-plugin-copilot/release.sh
 # @Telegram: https://t.me/missuo
 # 
 # Copyright © 2024 by Vincent, All Rights Reserved. 
### 
version=${1#refs/tags/v}
zip -r -j bob-plugin-copilot-$version.bobplugin src/*

sha256_copilot=$(sha256sum bob-plugin-copilot-$version.bobplugin | cut -d ' ' -f 1)
echo $sha256_copilot

download_link="https://github.com/missuo/bob-plugin-copilot/releases/download/v$version/bob-plugin-copilot-$version.bobplugin"

new_version="{\"version\": \"$version\", \"desc\": \"None\", \"sha256\": \"$sha256_copilot\", \"url\": \"$download_link\", \"minBobVersion\": \"0.5.0\"}"

json_file='appcast.json'
json_data=$(cat $json_file)

updated_json=$(echo $json_data | jq --argjson new_version "$new_version" '.versions += [$new_version]')

echo $updated_json > $json_file
mkdir dist
mv *.bobplugin dist