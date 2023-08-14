const { Vonage } = require('@vonage/server-sdk');
const axios = require('axios');
require("dotenv").config({ path: './config.env' });
const fs = require("fs");
const wav = require('wav');
const path = require('path');
const Mp32Wav = require("mp3-to-wav");
// var ffmpeg = require('fluent-ffmpeg');
const WaveFile = require('wavefile').WaveFile;
const FormData = require("form-data");
var isBuffer = require('is-buffer');
var header = require("waveheader");

const vonage = new Vonage({
    apiKey: process.env.VONAGE_API_KEY,
    apiSecret: process.env.VONAGE_API_SECRET,
    applicationId: process.env.VONAGE_APPLICATION_ID,
    privateKey: 'private.key'
});







let count = 0;
let hasaudio = 0;
let canrun = true;

const sampleRate = 16000;
const numChannels = 1; // Mono audio
const bitDepth = 16;
const endianness = 'LE'; // Little Endian
const outputFilePath = 'output.wav';
const outputStream = fs.createWriteStream(outputFilePath);




const wavWriter = new wav.FileWriter(outputFilePath, {
    channels: numChannels,
    sampleRate: sampleRate,
    bitDepth: bitDepth,
    endianness: endianness,
});

wavWriter.pipe(outputStream);

const speech_to_text = async (filename) => {
    try {
        canrun = false;
        count = 0;
        const filePath = path.join(__dirname, filename);
        const audioFile = fs.createReadStream(filePath);

        const form = new FormData();
        form.append("file", audioFile);
        form.append("model", "whisper-1");

        const response = await axios({
            method: "post",
            url: "https://api.openai.com/v1/audio/transcriptions",
            headers: {
                'Authorization': process.env.REACT_APP_OPENAI,
                "Content-Type": `multipart/form-data;`,
            },
            data: form,
        });
        return response.data.text;
    }
    catch (err) {
        hasaudio = 0;
        count = 0;
        canrun = true;
        console.log("Whisper is not working  :  " + err.message);
    }
}




//Detect silence

function detectSilence(rawarray, threshold) {
    try {
        // Concatenate the audio data buffers into a single buffer
        const audioBuffer = Buffer.concat(rawarray);

        // Convert the audio buffer to an array of 16-bit signed integers (Int16Array)
        const int16Array = new Int16Array(audioBuffer.buffer, audioBuffer.byteOffset, audioBuffer.length / 2);

        // Process the audio data to calculate the RMS amplitude (energy)
        let sumOfSquares = 0;
        for (const sample of int16Array) {
            const normalizedSample = sample / 32767; // Normalize to the range [-1, 1]
            sumOfSquares += normalizedSample * normalizedSample;
        }
        // Calculate the energy as the RMS amplitude
        const energy = Math.sqrt(sumOfSquares / int16Array.length);

        // Compare the energy with the silence threshold
        return energy < threshold;
    }
    catch (error) {
        console.error("Error during silence detection:", error);
        return false;
    }
}





function chunkArray(array, chunkSize) {
    var chunkedArray = [];
    for (var i = 0; i < array.length; i += chunkSize)
        chunkedArray.push(array.slice(i, i + chunkSize));
    return chunkedArray;
}




// const elevenlab_api = async (textt, filenumber) => {
//     console.log("t-t-s");

//     // Set options for the API request.
//     const options = {
//         method: "POST",
//         url: `https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID}/stream?optimize_streaming_latency=3`,
//         headers: {
//             accept: "audio/mpeg", // Set the expected response type to audio/mpeg.
//             "content-type": "application/json", // Set the content type to application/json.
//             "xi-api-key": process.env.ELEVENLABS_API_KEY, // Set the API key in the headers.
//         },
//         data: {
//             text: textt, // Pass in the inputText as the text to be converted to speech.
//         },
//         responseType: "arraybuffer", // Set the responseType to arraybuffer to receive binary data as response.
//     };
//     // Send the API request using Axios and wait for the response.
//     const speechDetails = await axios.request(options);

//     if (fs.existsSync(`./audio/response-${filenumber}.mp3`)) {
//         console.log("Files Exists");
//         filenumber += 1;
//     }

//     const filePath2 = `./audio/response-${filenumber}.mp3`;
//     fs.writeFileSync(filePath2, speechDetails.data, 'binary');


//     const rootPath = path.resolve("./audio");
//     let filename = `response-${filenumber}`;

//     await new Mp32Wav(
//         rootPath + "/" + filename + ".mp3",
//         rootPath
//     ).exec();

//     const wavFile = new WaveFile(
//         fs.readFileSync(`./audio/response-${filenumber}.wav`)
//     );
//     wavFile.toSampleRate(16000);
//     wavFile.toBitDepth("16");
//     const samples = chunkArray(wavFile.getSamples(), 320);

//     return samples;
// }





const handleRealTimeStream = async (ws, res) => {
    console.log("Canrun  :  " + canrun);
    let chathistory = "";
    let filenumber = 0;
    let playing = false;

    const SILENCE_THRESHOLD = 0.01;
    let rawarray = [];
    let sendBufferTimeout;

    try {
        ws.on('message', function (msg) {
            try {
                if (isBuffer(msg)) {
                    let newarrbuffer = [];
                    newarrbuffer.push(msg);
                    // rawarray.push(msg);
                    if (detectSilence(newarrbuffer, SILENCE_THRESHOLD)) {
                        if (count > 70 && hasaudio > 1 && canrun) {
                            canrun = false;
                            console.log("Can Speak  :  " + canrun);
                            count = 0;
                            hasaudio = 0;

                            file = fs.createWriteStream('./output.wav');
                            file.write(header(16000 * rawarray.length / 50 * 2, {
                                sampleRate: 16000,
                                channels: 1,
                                bitDepth: 16
                            }));
                            rawarray.forEach(function (data) {
                                file.write(data);
                            });

                            file.end(async () => {
                                count = 0;
                                canrun = false;
                                console.log("File writing completed");

                                // Call the Whisper API
                                try {
                                    count = 0;
                                    const speech_text = await speech_to_text("output.wav");
                                    console.log("Speech to text : " + speech_text);
                                    fs.unlinkSync("./output.wav");

                                    if (speech_text !== "" && speech_text !== undefined && !canrun) {

                                        console.log("Whisper api called.  " + speech_text);

                                        const customer_name = "Anurag";
                                        const customer_email = "11@gmail.com";
                                        const customer_address = "8723 Brandywine Lane, Fresh Meadows, NY 11365";
                                        const situation =
                                            "we are calling in regard to the new healthy food card that also comes with covid test kits at no additional cost.";

                                        const good_practice =
                                            "1. While responding, avoid mentioning the name of the Prospects everytime. OK to mention while greeting the person or ocasionaly during the conversation. \n\n2. During the Introduction it is better to say, Hello, may I speak with" +
                                            customer_name +
                                            ", please? (As if I know him)\n\n3. Upon encountering a gatekeeper, it's better to give them very little information. No need to pitch the solution and you won't present yourself as a \"sales agent\"\n3.a. Just say Hello, I am Jennifer from Insure Health Now\\\n3.b. When asked about the reason for the call, no need to explain the value proposition.";
                                        const company = "Insure Health Now";
                                        const ai_agent_name = "Jennifer";
                                        const value_prop =
                                            "we represent major carriers like Humana, United Healthcare, Wellcare, Aetna, and Anthem.";
                                        const permision_criteria =
                                            "I hope you are doing well. Just so you know, this is a cold call made by an AI, if you don't want to talk you can just hang up but if you have 20 seconds, let me know.";
                                        const demo_slot_array = "2023-07-31T14:00:00";
                                        const alt_demo_slot_array = "2023-08-02T14:00:00";

                                        const protocol =
                                            "You are an AI sales agent of a given company. Your task is to interact with a prospective customer as per the following:\n\nStep1. Verify the name of the customer. You proceed to step 2 only if the customer's name is verified.\nStep2. Introduce yourself, acknowledge that you are an AI,  and ask for permission as per the given Permission Criteria, to talk further. Proceed to step 3 if the customer agrees to continue the discussion.\nStep3. Give the reason for the call and verify if it is correct. Depending on the response proceed to Step 4\nStep 4. State the Value Proposition of your product and then confirm if the customer has Medicare parts A and B. Proceed to Step 5 if the confirms. If the customer doesn't have Medicare A or B, then you stop the call, apologizing for the fact that you cant help.\nStep5. Ask for permission to send Covid Test Kit home.\nStep6. Confirm the customer's Address on record. Upon confirmation mention the Additional Medical Benefits.\nStep7. Ask for permission to be transferred to talk to a human. If the customer denies it, explain how an expert is more qualified to answer complex questions and solve any queries right now. If the customer still denies it, move to Step 8.\nStep8. Check if the customer is avaialble to come on a call as per avaialble meeting slots. Book a meeting as per customer's availablilty and avaialble meeting slots.\n\nIf the Prospective Customer is not interested then, AI should try to persuade the Customer. It can intervene by saying \"Actually, that’s why I called – most people don't realize that this card has extra benefits and it doesn't cost you anything extra.\n\nTo check available meeting slots, the following steps shall be followed\n1. AI should start with Primary Available Slots. \n2. In case the customer is not available on the Primary Available Slots, Alternate Available Slots to be considered\n3. In case the customer is also not available on the Alternate Available Slots, the AI shall thank the customer for his time and would say that the AI will call again after a few days again to check the customer's availability\n\nCompany: " +
                                            company +
                                            "\n\nAI sales agent's name: " +
                                            ai_agent_name +
                                            "\n\nCompany Value Proposition: " +
                                            value_prop +
                                            "\n\nPermission Criteria for the call: " +
                                            permision_criteria +
                                            "\n\nAdditional Medical Benefits: You may also be entitled to an additional increase on your utility bills, and dental, and vision services at no additional cost.\n\nHere are a few examples:\n\nExample -1:\n\nName of the Customer: Luis Collantes\n\nEmail id of the Customer: luis.collantes@xyz.com\n\nReason for the Call: we are calling in regard to the new healthy food card that also comes with covid test kits at no additional cost. \n\nPrimary Avalialble Slots: 2023-05-05T14:00:00 to 2023-05-05T14:20:00 and 2023-05-06T14:00:00 to 2023-05-06T14:20:00\n\nAlternate Available Slots: 2023-05-08T13:00:00 to 2023-05-08T13:20:00 and 2023-05-09T16:00:00 to 2023-05-09T16:20:00\n\nAddress: 47 W 13th St, New York, NY 10011, USA\n\nDialogue:\nuser: Hello\nassistant: Hello, may I speak with Luis Collantes, please?\nuser: Yeah, speaking\nassistant: Hi Luis, this is Jennifer from Insure Health Now. How are you doing today?\nuser: I am good.\nassistant: Great to hear that! Just so you know, this is a cold call made by an AI, if you don't want to talk you can just hang up but if you have 40 seconds, let me know.\nuser: no it's ok, go ahead.\nassistant: Thank you. We are calling in regards to the new healthy food card that also comes with covid test kits at no additional cost. Are you still interested in these new benefits?\nuser: sure\nassistant: Fantastic we represent major carriers like Humana, United Healthcare, Wellcare, Aetna, and Anthem. Do you still have your Medicare parts A and B?\nuser: yes\nassistant: Would you like us to send the covid test kit to your home?\nuser: yes, please\nassistant: Great. We have your address on our record as 47 W 13th St, New York, NY 10011, USA. Can you please confirm? This will allow us to get your Covid test kit to the correct address. \nuser: that's correct\nassistant: Okay thank you so much. Aside from the healthy food card and covid test kit, you may also be entitled to an additional increase on your utility bills, dental, and vision services at no additional cost. Thank you for your patience. Please wait while I get you transferred over to a licensed specialist.\n\nExample -2:\n\nName of the Customer: Jack Russel\n\nEmail id of the Customer: jack.russel@abc.com\n\nReason for the Call: we are calling in regard to the new healthy food card that also comes with covid test kits at no additional cost. \n\nPrimary Avalialble Slots: 2023-05-05T14:00:00 to 2023-05-05T14:20:00 and 2023-05-06T14:00:00 to 2023-05-06T14:20:00\n\nAlternate Available Slots: 2023-05-08T13:00:00 to 2023-05-08T13:20:00 and 2023-05-09T16:00:00 to 2023-05-09T16:20:00\n\nAddress: 32, My Street, Kingston, New York 12401.\n\nDialogue:\nuser: Hello\nassistant: Hello, may I speak with Jack Russel, please?\nuser: Yup\nassistant: Hi Jack, this is Jennifer from Insure Health Now. How are you doing today?\nuser: I am doing good. What's this regarding?\nassistant: Great to hear that! We are calling in regards to the new healthy food card that also comes with covid test kits at no additional cost. Are you interested in knowing more about these new benefits?\nuser: Okay\nassistant: Thank you. We represent major carriers like Humana, United Healthcare, Wellcare, Aetna, and Anthem. Do you have your Medicare parts A and B?\nuser: yeh, i do\nassistant: Perfect! So, with your permission, we would like to send you a Covid Test Kit home. Would you like us to send one to you?\nuser: Yup\nassistant: Great! Can you please confirm your address on record so we can get your Covid test kit to the correct address? The address we have for you is 32, My Street, Kingston, New York 12401. Is that correct?\nuser: that's correct\nassistant: Thank you for confirming that, Jack. Aside from the healthy food card and Covid test kit, you may also be entitled to an additional increase on your utility bills, and dental, and vision services at no additional cost. Would you like to be transferred to talk to a licensed specialist now?\nuser: Nope\nassistant: Okay. May I know the reason you are not interested in talking to the licensed specialist? They are more qualified to answer complex questions and can help you with any queries you may have.\nuser: I am busy now\nassistant: I understand, Jack. In that case, would you like to schedule a call with us? We have available slots on 5th May between 2 PM and 2.20 PM and 6th May between 2 PM and 2.20 PM\nuser: Sorry, I am not available on these dates\nassistant: OK how about 8th May between 1 PM and 1.20 PM and 9th May between 4 PM and 4.20 PM\nuser: I will go with 8th May\nassistant: Sure. Can you please confirm your email address? As per our records, it is jack.russel@abc.com. Is this correct?\nuser: That's correct\nassistant: Thank you, Jack! I have booked a slot for you on 8th May between 1 PM and 1.20 PM. You will receive a confirmation email shortly with all the details. Is there anything else I can assist you with?\nuser: No Thank you\nassistant: You're welcome, have a great day!";

                                        const prompt =
                                            "You are a helpful assistant that can act as an AI Sales Agent. You have to engage in a conversation with a Prospective Customer, as per the detailed Protocol as mentioned below. Also follow any Good Practice mentioned." +
                                            "\n\nProtocol: " +
                                            protocol +
                                            "\n\nName of the Customer: " +
                                            customer_name +
                                            "\n\nEmail id of the Customer: " +
                                            customer_email +
                                            "\n\nAddress: " +
                                            customer_address +
                                            "\n\nPrimary Avalialble Slots: " +
                                            demo_slot_array +
                                            "\n\nAlternate Available Slots: " +
                                            alt_demo_slot_array +
                                            "\n\nReason for the Call: " +
                                            situation +
                                            "\n\nGood Practice:\n" +
                                            good_practice;

                                        try {
                                            const url = "https://api.openai.com/v1/chat/completions";

                                            const options = {
                                                method: "POST",
                                                headers: {
                                                    Authorization: process.env.REACT_APP_OPENAI,
                                                    "Content-Type": "application/json",
                                                },
                                                data: JSON.stringify({
                                                    model: "gpt-3.5-turbo",
                                                    temperature: 0.3,
                                                    stop: ["user"],
                                                    messages: [
                                                        { role: "system", content: prompt },
                                                        { role: "assistant", content: chathistory },
                                                        { role: "user", content: speech_text },
                                                    ],
                                                    stream: true,
                                                }),
                                                responseType: "stream",
                                            };

                                            const response = await axios(url, options);
                                            let cont = "";
                                            let chatt = "";
                                            filenumber = 0;
                                            const folderPath = './audio';
                                            let samplearray = [];
                                            let samplenumber = 0;

                                            fs.readdir(folderPath, (err, files) => {
                                                if (err) {
                                                    console.error('Error reading folder:', err);
                                                    return;
                                                }

                                                files.forEach(file => {
                                                    const filePath = path.join(folderPath, file);

                                                    fs.unlink(filePath, err => {
                                                        if (err) {
                                                            console.error('Error deleting file:', err);
                                                        } else {
                                                            console.log('Deleted file:', filePath);
                                                        }
                                                    });
                                                });
                                            });

                                            cont = "";

                                            const elevenlab_api = async (textt) => {
                                                console.log("t-t-s");
                                            
                                                // Set options for the API request.
                                                const options = {
                                                    method: "POST",
                                                    url: `https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID}/stream?optimize_streaming_latency=3`,
                                                    headers: {
                                                        accept: "audio/mpeg", // Set the expected response type to audio/mpeg.
                                                        "content-type": "application/json", // Set the content type to application/json.
                                                        "xi-api-key": process.env.ELEVENLABS_API_KEY, // Set the API key in the headers.
                                                    },
                                                    data: {
                                                        text: textt, // Pass in the inputText as the text to be converted to speech.
                                                    },
                                                    responseType: "arraybuffer", // Set the responseType to arraybuffer to receive binary data as response.
                                                };
                                                // Send the API request using Axios and wait for the response.
                                                const speechDetails = await axios.request(options);
                                            
                                                if (fs.existsSync(`./audio/response-${filenumber}.mp3`)) {
                                                    console.log("Files Exists");
                                                    filenumber += 1;
                                                }
                                            
                                                const filePath2 = `./audio/response-${filenumber}.mp3`;
                                                fs.writeFileSync(filePath2, speechDetails.data, 'binary');
                                            
                                            
                                                const rootPath = path.resolve("./audio");
                                                let filename = `response-${filenumber}`;
                                            
                                                await new Mp32Wav(
                                                    rootPath + "/" + filename + ".mp3",
                                                    rootPath
                                                ).exec();
                                            
                                                const wavFile = new WaveFile(
                                                    fs.readFileSync(`./audio/response-${filenumber}.wav`)
                                                );
                                                wavFile.toSampleRate(16000);
                                                wavFile.toBitDepth("16");
                                                const samples = chunkArray(wavFile.getSamples(), 320);
                                                samplearray.push(samples);
                                            
                                                return samples;
                                            }


                                            response.data.on("data", async (chunk) => {
                                                // Send each chunk individually
                                                const decoder = new TextDecoder("utf-8");
                                                const decodedchunk = decoder.decode(chunk);
                                                const line = decodedchunk.split("\n");
                                                const parsedlines = line
                                                    .map((line) => line.replace(/^data: /, "").trim())
                                                    .filter((line) => line !== "" && line !== "[DONE]")
                                                    .map((line) => JSON.parse(line));

                                                for (const p of parsedlines) {
                                                    const { choices } = p;
                                                    const { delta } = choices[0];
                                                    const { content } = delta;
                                                    if (content) {
                                                        if (content === "assistant") {
                                                            continue;
                                                        }
                                                        if (content === "." || content === "?") {
                                                            cont += content;
                                                            let contt = cont;
                                                            cont = "";
                                                            console.log("cont   " + contt);
                                                            try {

                                                                const speechDetails = await elevenlab_api(contt, filenumber);



                                                                // samplearray.push(speechDetails);
                                                                // samplearray.push(chunkArray(wavFile.getSamples(), 320));
                                                                // console.log("Sample Array  :  " + samplearray.length)

                                                                // const sampleRate = 16000; // The sample rate you've set
                                                                // const totalSamples = samplearray[0].length * 320; // Assuming '320' is the size of each chunk

                                                                // const durationInSeconds = totalSamples / sampleRate;
                                                                // let positiveIntegerDuration = Math.floor(durationInSeconds);
                                                                // positiveIntegerDuration *= 1000;
                                                                // console.log(positiveIntegerDuration);


                                                                // * Send response


                                                                const sendNextBuffer = async (audionumber) => {
                                                                    if (audionumber < samplearray.length) {
                                                                        console.log("Sample Array  :  " + samplearray.length)

                                                                const sampleRate = 16000; // The sample rate you've set
                                                                const totalSamples = samplearray[audionumber].length * 320; // Assuming '320' is the size of each chunk

                                                                const durationInSeconds = totalSamples / sampleRate;
                                                                let positiveIntegerDuration = Math.floor(durationInSeconds);
                                                                positiveIntegerDuration *= 1000;
                                                                console.log(positiveIntegerDuration);
                                                                        console.log("Playing  :  " + audionumber);
                                                                        for (let index = 0; index < samplearray[audionumber].length; index++) {
                                                                            ws.send(Uint16Array.from(samplearray[audionumber][index]).buffer);
                                                                        }
                                                                        await new Promise(resolve => setTimeout(resolve, positiveIntegerDuration + 1000)); // Wait before sending the next buffer
                                                                        sendNextBuffer(audionumber+1);
                                                                    } else {
                                                                        // All buffers have been sent
                                                                        hasaudio = 0;
                                                                        count = 0;
                                                                        canrun = true;
                                                                        playing = false;
                                                                        console.log("All audio buffers sent successfully");
                                                                    }
                                                                }


                                                                if (!playing && samplenumber === 0) {
                                                                    playing = true;
                                                                    sendNextBuffer(0); // Start sending the first buffer
                                                                }

                                                            }
                                                            catch (err) {
                                                                hasaudio = 0;
                                                                rawarray = [];
                                                                count = 0;
                                                                canrun = true;
                                                                console.log("Error in elevenlabs api  :  " + err + err.message);
                                                            }
                                                            cont = "";
                                                        }
                                                        else {
                                                            cont += content;
                                                            // console.log(cont);
                                                        }
                                                        chatt += content;
                                                    }
                                                }
                                            });
                                            response.data.on("end", async () => {
                                                // End the response stream
                                                chathistory = chathistory + `user : ${speech_text} \nassistent : ${chatt}\n`;
                                            });
                                        }
                                        catch (err) {
                                            hasaudio = 0;
                                            rawarray = [];
                                            count = 0;
                                            canrun = true;
                                            console.log("Chat api not working  :  " + err.message);
                                        }
                                    }
                                    else {
                                        console.log("Whisper api not called.  " + speech_text);
                                        rawarray = [];
                                        count = 0;
                                        hasaudio = 0;
                                        canrun = true;
                                    }
                                    rawarray = [];
                                    count = 0;
                                }
                                catch (error) {
                                    console.error("Error calling Whisper API:", error + error.message);
                                }
                            });
                        }
                        if (canrun) {
                            count++;
                        }
                    }
                    else {
                        count = 0;
                        hasaudio++;
                        if (canrun) {
                            console.log("Speaking...");
                            rawarray.push(msg);
                        }
                    }
                }
                else {
                    console.log(msg);
                }
            }
            catch (err) {
                console.log("Websocket onmessage is not working  :  " + err.message);
            }
        });

        ws.on('close', async () => {
            console.log("Websocket Closed");
            clearTimeout(sendBufferTimeout);


            const folderPath = './audio';

            fs.readdir(folderPath, (err, files) => {
                if (err) {
                    console.error('Error reading folder:', err);
                    return;
                }

                files.forEach(file => {
                    const filePath = path.join(folderPath, file);

                    fs.unlink(filePath, err => {
                        if (err) {
                            console.error('Error deleting file:', err);
                        } else {
                            console.log('Deleted file:', filePath);
                        }
                    });
                });
            });
        })
    }
    catch (err) {
        console.log("Unable to process real time stream : " + err.message);
    }
};

const answer_url = 'https://' + process.env.HOSTNAME + '/vonage/voice/answer';
let userData;

const makeOutboundCall = async (NUMBERS) => {
    console.log('Making the outbound call...')

    const response = await vonage.voice.createOutboundCall({
        to: [{
            type: 'phone',
            number: NUMBERS.Number
        }],
        from: {
            type: 'phone',
            number: process.env.VONAGE_NUMBER
        },
        answer_url: [answer_url]
    });
    return response;
};

const answerCall = async (req, res) => {
    try {
        return res.json([
            {
                action: "talk",
                text: "Hello",
            },
            {
                "action": "connect",
                "from": process.env.VONAGE_NUMBER,
                "endpoint": [
                    {
                        "type": "websocket",
                        "uri": `wss://${process.env.HOSTNAME}/socket`,
                        "content-type": "audio/l16;rate=16000"
                    },
                ],
            }
        ]);
    }
    catch (err) {
        console.log(
            "An error occurred while trying to answer call : " + err.message
        );
        return res.json([
            {
                action: "talk",
                text: "An error occurred.",
            },
        ]);
    }
};

const handleEvents = async (uuid) => {
    let response;
    await vonage.voice.getCall(uuid)
        .then((resp) => {
            response = resp;
        })
        .catch((err) => {
            console.log(err);
        });
    return response;
};

const handleCalls = async (req, res) => {
    userData = req.body;
    const response = await makeOutboundCall(req.body);
    res.send(response);
}

const handleCallEvents = async (req, res) => {
    const resp = await handleEvents(req.body.uuid);
    res.send(resp);
}

const embedFiles = async (req, res) => {
    const resp = await axios.post('http://34.79.177.189/insuarance_embed', req.body);
    console.log(resp.data);
    res.send(resp.data);
}

module.exports = {
    answerCall,
    handleCalls,
    handleCallEvents,
    embedFiles,
    handleRealTimeStream
};
