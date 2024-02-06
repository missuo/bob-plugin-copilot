/*
 * @Author: Vincent Young
 * @Date: 2024-02-04 17:42:51
 * @LastEditors: Vincent Young
 * @LastEditTime: 2024-02-05 22:08:56
 * @FilePath: /bob-plugin-copilot/src/main.js
 * @Telegram: https://t.me/missuo
 * 
 * Copyright © 2024 by Vincent, All Rights Reserved. 
 */

var lang = require("./lang.js");

function supportLanguages() {
    return lang.supportLanguages.map(([standardLang]) => standardLang);
}

function buildHeader() {
    return {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": "Fuck_GFW"
    };
}

function generatePrompts(query, mode, customizePrompt) {
    let userPrompt = ""
    if (mode == "1") {
        const translationPrefixPrompt = 'Please translate below text'
        userPrompt = `${translationPrefixPrompt} from "${lang.langMap.get(query.detectFrom) || query.detectFrom}" to "${lang.langMap.get(query.detectTo) || query.detectTo}"`;

        if (query.detectTo === "wyw" || query.detectTo === "yue") {
            userPrompt = `${translationPrefixPrompt} to "${lang.langMap.get(query.detectTo) || query.detectTo}"`;
        }

        if (
            query.detectFrom === "wyw" ||
            query.detectFrom === "zh-Hans" ||
            query.detectFrom === "zh-Hant"
        ) {
            if (query.detectTo === "zh-Hant") {
                userPrompt = `${translationPrefixPrompt} to traditional Chinese`;
            } else if (query.detectTo === "zh-Hans") {
                userPrompt = `${translationPrefixPrompt} to simplified Chinese`;
            } else if (query.detectTo === "yue") {
                userPrompt = `${translationPrefixPrompt} to Cantonese`;
            }
        }
    }
    else if(mode == "2") {
        userPrompt = `Please polish this sentence without changing its original meaning.`;
    }
    else if(mode == "3") {
        userPrompt = `Please answer the following question.`;
    }
    else if(mode == "4") {
        userPrompt = customizePrompt
    }
 
    userPrompt = `${userPrompt}:\n${query.text}`
    return userPrompt;
}

function buildRequestBody(model, mode, customizePrompt, query) {
    const prompt = generatePrompts(query, mode, customizePrompt);
    return {
        model,
        messages: [{
            "role": "system",
            "content": ` ${prompt}`
        }]
    };
}

function handleGeneralError(query, error) {
    if ('response' in error) {
        // 处理 HTTP 响应错误
        const {
            statusCode
        } = error.response;
        const reason = (statusCode >= 400 && statusCode < 500) ? "param" : "api";
        query.onCompletion({
            error: {
                type: reason,
                message: `接口响应错误 - ${statusCode}`,
                addition: `${JSON.stringify(error)}`,
            },
        });
    } else {
        // 处理一般错误
        query.onCompletion({
            error: {
                ...error,
                type: error.type || "unknown",
                message: error.message || "Unknown error",
            },
        });
    }
}

function handleStreamResponse(query, targetText, textFromResponse) {
    if (textFromResponse !== '[DONE]') {
        try {
            const dataObj = JSON.parse(textFromResponse);
            const {
                choices
            } = dataObj;
            const delta = choices[0]?.delta?.content;
            if (delta) {
                targetText += delta;
                query.onStream({
                    result: {
                        from: query.detectFrom,
                        to: query.detectTo,
                        toParagraphs: [targetText],
                    },
                });
            }
        } catch (err) {
            handleGeneralError(query, {
                type: err.type || "param",
                message: err.message || "Failed to parse JSON",
                addition: err.addition,
            });
        }
    }
    return targetText;
}


function translate(query) {
    if (!lang.langMap.get(query.detectTo)) {
        query.onCompletion({
            error: {
                type: "unsupportLanguage",
                message: "不支持该语种",
                addtion: "不支持该语种",
            },
        });
    }

    const {
        model,
        apiUrl = 'https://api.qwq.mx',
        mode,
        customizePrompt,
    } = $option;

    const apiUrlPath = "/v1/chat/completions";

    const header = buildHeader();
    const body = buildRequestBody(model, mode, customizePrompt, query);

    let targetText = ""; // 初始化拼接结果变量
    let buffer = ""; // 新增 buffer 变量
    (async () => {

        await $http.streamRequest({
            method: "POST",
            url: apiUrl + apiUrlPath,
            header,
            body: {
                ...body,
                stream: true,
            },
            cancelSignal: query.cancelSignal,
            streamHandler: (streamData) => {
                if (streamData.text?.includes("Invalid token")) {
                    handleGeneralError(query, {
                        type: "secretKey",
                        message: "配置错误 - 请确保您在插件配置中填入了正确的 API Keys",
                        addition: "请在插件配置中填写正确的 API Keys",
                        troubleshootingLink: "https://bobtranslate.com/service/translate/openai.html"
                    });
                } else if (streamData.text !== undefined) {
                    // 将新的数据添加到缓冲变量中
                    buffer += streamData.text;
                    // 检查缓冲变量是否包含一个完整的消息
                    while (true) {
                        const match = buffer.match(/data: (.*?})\n/);
                        if (match) {
                            // 如果是一个完整的消息，处理它并从缓冲变量中移除
                            const textFromResponse = match[1].trim();
                            targetText = handleStreamResponse(query, targetText, textFromResponse);
                            buffer = buffer.slice(match[0].length);
                        } else {
                            // 如果没有完整的消息，等待更多的数据
                            break;
                        }
                    }
                }
            },
            handler: (result) => {
                if (result.response.statusCode >= 400) {
                    handleGeneralError(query, result);
                } else {
                    query.onCompletion({
                        result: {
                            from: query.detectFrom,
                            to: query.detectTo,
                            toParagraphs: [targetText],
                        },
                    });
                }
            }
        });

    })().catch((err) => {
        handleGeneralError(query, err);
    });
}

exports.supportLanguages = supportLanguages;
exports.translate = translate;