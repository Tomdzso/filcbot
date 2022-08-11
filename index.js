import { parse } from "node-html-parser";
import fetch from "node-fetch";
import { Intents, Client, MessageEmbed, MessageAttachment, MessageActionRow, MessageButton, IntegrationApplication } from "discord.js";
import crypto from "crypto";
import cassandra from "cassandra-driver";

import config from "./config.js";
const { token, astra } = config;

const database = new cassandra.Client(astra);

const client = new Client({ intents: [Intents.FLAGS.GUILDS] });

const starsigns = ["kos", "bika", "ikrek", "rák", "oroszlán", "szűz", "mérleg", "skorpió", "nyilas", "bak", "vízöntő", "halak"];

const normalize = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function timeUntilMidnight() {
    const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Budapest" }));
    return (((23 - d.getHours()) * 60 + (59 - d.getMinutes())) * 60 + (59 - d.getSeconds())) * 1000 + (1000 - d.getMilliseconds());
}

function createRatingButtons(target, info) {
    const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Budapest" }));
    const datestring = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    return new MessageActionRow().addComponents(
        new MessageButton()
            .setCustomId("rating-" + target + "-1-" + datestring + "-" + info)
            .setLabel("1")
            .setStyle(4),
        new MessageButton()
            .setCustomId("rating-" + target + "-2-" + datestring + "-" + info)
            .setLabel("2")
            .setStyle(1),
        new MessageButton()
            .setCustomId("rating-" + target + "-3-" + datestring + "-" + info)
            .setLabel("3")
            .setStyle(1),
        new MessageButton()
            .setCustomId("rating-" + target + "-4-" + datestring + "-" + info)
            .setLabel("4")
            .setStyle(1),
        new MessageButton()
            .setCustomId("rating-" + target + "-5-" + datestring + "-" + info)
            .setLabel("5")
            .setStyle(3)
    );
}

const months = ["januar", "februar", "marcius", "aprilis", "majus", "junius", "julius", "augusztus", "szeptember", "oktober", "november", "december"];
async function fetchHoroscope(starsign, date) {
    const html = parse(
        await (
            await fetch(
                `https://www.astronet.hu/horoszkop/${starsign}-napi-horoszkop/${date.getFullYear()}-${months[date.getMonth()]}-${date
                    .getDate()
                    .toString()
                    .padStart(2, "0")}/`
            )
        ).text()
    );

    return html.querySelectorAll(".details-content")[0].childNodes[0]._rawText;
}

const horoscopeCache = {};
var horoscopePromise;
function saveHoroscopes() {
    setTimeout(saveHoroscopes, timeUntilMidnight());
    const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Budapest" }));
    horoscopePromise = Promise.all(
        starsigns.map(async (starsign) => {
            horoscopeCache[normalize(starsign)] = await fetchHoroscope(normalize(starsign), d);
        })
    );
}
saveHoroscopes();

client.once("ready", () => {
    console.log("Re(a)dy!");
});

client.on("interactionCreate", async (interaction) => {
    switch (interaction.type) {
        case "APPLICATION_COMMAND":
            const { commandName, options } = interaction;
            switch (commandName) {
                case "ping":
                    await interaction.reply("Pong!");
                    setTimeout(async () => {
                        await interaction.deleteReply();
                    }, 30000);
                    break;
                case "horoszkóp":
                    if (interaction.channelId === "992771006403985429" || interaction.channelId === "996791511754735769") {
                        await horoscopePromise;
                        const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Budapest" }));

                        await interaction.reply({
                            embeds: [
                                new MessageEmbed()
                                    .setColor("#2D2247")
                                    .setTitle(":milky_way:  A mai napi horoszkópod:")
                                    .setDescription(horoscopeCache[options.getString("csillagjegy")])
                                    .setFooter(
                                        d.getHours() >= 16
                                            ? {
                                                  text: "Kérlek értékeld alább, hogy mennyire pontos a mai napodra vonatkozóan a horoszkópod. A válaszod anonim, dönts őszintén. (1: a valóság szöges ellentéte; 5: minden szava arany)",
                                              }
                                            : null
                                    ),
                            ],
                            components: d.getHours() >= 16 ? [createRatingButtons("horoscope", options.getString("csillagjegy"))] : null,
                        });
                    } else {
                        await interaction.reply("<#992771006403985429>");
                        setTimeout(async () => {
                            await interaction.deleteReply();
                        }, 30000);
                    }
                    break;
                case "catboy":
                    if (crypto.randomInt(100, 151) === 143) {
                        await interaction.reply({
                            content: "aaaahhhahhhhh nya~",
                            files: [
                                new MessageAttachment()
                                    .setName("catboy")
                                    .setDescription("Művész: Stok*** Bálint")
                                    .setFile("http://storage.igenzet.hu/filc/bot/stoki_eredeti.jpg"),
                            ],
                            components: [createRatingButtons("catboy", "0")],
                        });
                    } else {
                        const image = await (await fetch("https://api.catboys.com/img")).json();
                        await interaction.reply({
                            content: (await (await fetch("https://api.catboys.com/catboy")).json()).response,
                            files: [
                                new MessageAttachment()
                                    .setName("catboy")
                                    .setDescription(image.artist === "unknown" ? "ismeretlen művész" : "Művész: " + image.artist)
                                    .setFile(image.url),
                            ],
                            components: [createRatingButtons("catboy", image.url.split("_")[1].split(".")[0])],
                        });
                    }
                    break;
            }
            break;

        case "MESSAGE_COMPONENT":
            if (interaction.customId.startsWith("rating-")) {
                const parts = interaction.customId.split("-");
                switch (parts[1]) {
                    case "horoscope":
                        if (interaction.user.id === interaction.message.interaction.user.id) {
                            await database.execute(
                                "INSERT INTO horoscoperatings (id, medium, queriedday, queriedsign, rating, sentday, sentsign, source) VALUES (uuid(), 'discord', ?, ?, ?, ?, ?, ?);",
                                [
                                    new Date(parts.slice(3, 6).join("-")),
                                    parts[6],
                                    parts[2],
                                    new Date(parts.slice(3, 6).join("-")),
                                    parts[6],
                                    "astronet",
                                ],
                                { prepare: true }
                            );
                            const embed = interaction.message.embeds[0];
                            delete embed.footer;
                            await interaction.update({ embeds: [embed], components: [] });
                        } else {
                            await interaction.reply({ content: "Csak a saját horoszkópodat értékelheted.", ephemeral: true });
                        }
                        break;

                    case "catboy":
                        await database.execute(
                            "UPDATE catboyratings SET rating=? WHERE user=? AND image=?;",
                            [parts[2], interaction.user.id, parts[4]],
                            { prepare: true }
                        );
                        await interaction.reply({ content: "Az értékelésed rögzítésre került.", ephemeral: true });
                        break;

                    default:
                        return;
                }
            }
            break;

        default:
            return;
    }
});

client.login(token);
