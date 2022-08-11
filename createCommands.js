import { SlashCommandBuilder } from "@discordjs/builders";
import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v9";
import config from "./config.js";

const { token, clientId, guildId } = config;

const starsigns = ["kos", "bika", "ikrek", "rák", "oroszlán", "szűz", "mérleg", "skorpió", "nyilas", "bak", "vízöntő", "halak"];

const normalize = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const commands = [
    new SlashCommandBuilder().setName("ping").setDescription("Anyádat pingeld. Mármint hogy... úgy értem... :ping_pong:"),
    new SlashCommandBuilder()
        .setName("horoszkóp")
        .setDescription("A mai napi horoszkópod.")
        .addStringOption((option) =>
            option
                .setName("csillagjegy")
                .setDescription("A születésnapod által meghatározott csillagjegyed.")
                .setRequired(true)
                .addChoices(...starsigns.map((starsign) => ({ name: starsign, value: normalize(starsign) })))
        ),
    new SlashCommandBuilder().setName("catboy").setDescription("A Ferihajóban csak catgirl van, ki kellett egészíteni."),
].map((command) => command.toJSON());

const rest = new REST({ version: "9" }).setToken(token);

rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands })
    .then(() => console.log("Successfully registered application commands."))
    .catch(console.error);