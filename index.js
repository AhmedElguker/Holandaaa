const { StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, EmbedBuilder, SlashCommandBuilder } = require("@discordjs/builders");
const Discord = require("discord.js");
const {QuickDB, SqliteDriver} = require("quick.db")
const db = new QuickDB({driver: new SqliteDriver(`${process.cwd()}/databases/local/db.sqlite`), filePath: `${process.cwd()}/databases/local/db.sqlite`})
const client = new Discord.Client({intents: [
    Discord.IntentsBitField.Flags.GuildMembers,
    Discord.IntentsBitField.Flags.GuildMessages,
    Discord.IntentsBitField.Flags.Guilds,
    Discord.IntentsBitField.Flags.MessageContent,
]})
const config = require("./config.json")
const axios = require("axios")
const rest = new Discord.REST({ version: '9' }).setToken(process.env.token)

const express = require("express")
const app = express()
app.get("/", (req, res) => {
    res.send("Hello World!")
})
app.listen(3000, () => {
    console.log("Project is ready!")
})
let slashCmdsArray = []
let commands = [
  {
    data: new SlashCommandBuilder()
    .setName("ticket")
    .setDescription(".")
    .addSubcommand(subcommand => subcommand.setName("close").setDescription("to close the ticket")
                   )
    .addSubcommand(subcommand => subcommand.setName("debug").setDescription("to debug a ticket")
                   )
                   
  }
]
commands.forEach(cmd => {
  slashCmdsArray.push(cmd.data.toJSON())
})


client.on("ready", async () => {
    
    await rest.put(
        Discord.Routes.applicationCommands(client.user.id),
        {body: slashCmdsArray}
    ).then(() => {
      console.log("ready")

    })

})

async function createTicketMenuOptions() {
    const options = []
    const tickets = config.tickets
    for (const ticket of tickets) {
        const option = new StringSelectMenuOptionBuilder()
            .setLabel(ticket.name)
            .setValue(ticket.value)
        options.push(option)
    }
    return options
}



client.on("messageCreate", async msg => {
  if (msg.content.startsWith("!setup")) {
        if (!msg.member.permissions.has("Administrator")) {
            return;
        }

    
        let options = await createTicketMenuOptions()
      
        let embed = new Discord.EmbedBuilder()
        .setTitle(`فتح تذكرة`)
        .setDescription(`## اختار نوع التذكرة التي تريد فتحها`)
        .setColor("DarkAqua")


        let menu = new StringSelectMenuBuilder()
        .setCustomId("ticketsMenu")
        .setMaxValues(1)
        .setMinValues(1)
        .setPlaceholder("اختر نوع التذكرة")
        .addOptions(options)
        

        let row = new Discord.ActionRowBuilder()
        .addComponents([menu])

        msg.channel.send({
            embeds: [embed],
            components: [row]
        })
    }
  if (msg.content.startsWith("!close")) {

        if (!msg.member.roles.cache.has("1143835993389137950")) {
            return;
        }

    let channel = msg.channel 

        let closedTickets = await db.get("closedTickets")

        if (closedTickets) {
            let t = closedTickets.find(id => id === channel.id) 

        if (t) {
            return msg.reply({
                content: `هذه التذكرة مغلقة`,
                ephemeral: true
            })
        }
        }

      msg.channel.send({
        embeds: [new EmbedBuilder()
            .setDescription(`جاري اغلاق التذكرة هذا الاجراء قد يأخذ بعض الوقت`)
        .setColor(Discord.Colors.Yellow)]
      })


        await channel.edit({
            permissionOverwrites: [
                {
                    id: msg.member.id,
                    deny: ["SendMessages", "ViewChannel", "AttachFiles"]
                },
                {
                    id: client.user.id,
                    allow: ["SendMessages", "ViewChannel", "AttachFiles"]
                },
                {
                    id: msg.guild.roles.everyone,
                    deny: ["ViewChannel"]
                }
            ]
        })


        let transcripter = require("discord-html-transcripts")

        let attachment = await transcripter.createTranscript(channel)

        let request = await axios({
            url: "https://ticketsarchive--tickbot.repl.co/archive",
            method: "POST",
            data: {
                fileData: `${attachment.attachment.toString()}`,
                id: channel.id
            }
        })

        let ticket = await db.get(`ticket_${channel.id}`)
        let ticketClaimedBy = await db.get(`claimed_${channel.id}`)
        if (ticketClaimedBy !== "no") {
            ticketClaimedBy = `<@${ticketClaimedBy}>`
        }
        if (!ticket) return interaction.channel.send({
          embeds: [new EmbedBuilder()
                  .setTitle("خطأ")
                  .setDescription(`هذه التذكرة ليست موجودة في قاعدة البيانات الخاصة بي قد تكون محذوفة او غير موجودة لذلك الرجاء حذفها يدويا من البرنامج`)
                  .setColor(Discord.Colors.Red)]
        });

        await db.delete(`ticket_${channel.id}`) 
      await db.delete(`hasaticket_${msg.member.id}`)
        await db.push("closedTickets", channel.id)

        let owner = await msg.guild.members.fetch(ticket.owner)

        let linkBtn = new ButtonBuilder()
        .setStyle(Discord.ButtonStyle.Link)
        .setURL(`https://ticketsarchive--tickbot.repl.co/ticket/${channel.id}`)
        .setLabel("النسخة الالكترونية من التذكرة")

        const r = new Discord.ActionRowBuilder()
        .addComponents([linkBtn])

        await owner.send({
            embeds: [new EmbedBuilder()
            .setColor(Discord.Colors.Aqua)
        .setDescription(`تم اغلاق تذكرتك في سيرفر : ${msg.guild.name}
        من قبل : ${msg.member}
        تم حفظ نسخة الكترونية من التذكرة الخاصة بك اضغط على الزر بالاسفل لرؤيتها`)],
        components: [r]
        })


        await channel.send({
            embeds: [new EmbedBuilder()
            .setTitle(`التذكرة مغلقة`)
        .setDescription(`تم اغلاق التذكرة بنجاح من قبل : ${msg.member}`)
    .setColor(Discord.Colors.Red)],
        })
        await channel.send(`### من اجل مراجعة التذكرة تم حفظ نسخة الكترونية منها في قاعدة البيانات الخاصة بنا ويمكن رؤيتهعا من خلال هذا الرابط : https://ticketsarchive--tickbot.repl.co/ticket/${channel.id}`)
        await channel.send("جاري حذف التذكرة")
        setTimeout(async () => {
          let logChannel = await msg.guild.channels.fetch(config.logID)
            await logChannel.send({
                embeds: [new EmbedBuilder()
                .setTitle("غلق تذكرة")
            .setDescription(`تم غلق تذكرة 
            معلومات التذكرة :

            صاحب التذكرة : ${owner}
            ايدي التذكرة : ${channel.id}
            مستلمة من قبل : ${ticketClaimedBy}
            اغلقت من قبل : ${msg.member}`)
        .setColor(Discord.Colors.Red)],
        components: [r]
            })
            channel.delete()
        }, 5000)
    
  }
})

client.on("interactionCreate", async interaction => {
  if (interaction.isCommand()) {
    if (interaction.commandName === "ticket") {
      if (interaction.options.getSubcommand() === "close") {
        if (!interaction.member.roles.cache.has("1143835993389137950")) {
            return;
        }
        let channel = interaction.channel
        let closedTickets = await db.get("closedTickets")
        if (closedTickets) {
            let t = closedTickets.find(id => id === channel.id)
            if (t) {
              return interaction.reply({
                  content: `هذه التذكرة مغلقة`,
                  ephemeral: true
              })
            }
            
      }
        interaction.reply({
          embeds: [new EmbedBuilder()
              .setDescription(`جاري اغلاق التذكرة هذا الاجراء قد يأخذ بعض الوقت`)
          .setColor(Discord.Colors.Yellow)]
        })


          await channel.edit({
              permissionOverwrites: [
                  {
                      id: interaction.member.id,
                      deny: ["SendMessages", "ViewChannel", "AttachFiles"]
                  },
                  {
                      id: client.user.id,
                      allow: ["SendMessages", "ViewChannel", "AttachFiles"]
                  },
                  {
                      id: interaction.guild.roles.everyone,
                      deny: ["ViewChannel"]
                  }
              ]
          })


          let transcripter = require("discord-html-transcripts")

          let attachment = await transcripter.createTranscript(channel)

          let request = await axios({
              url: "https://ticketsarchive--tickbot.repl.co/archive",
              method: "POST",
              data: {
                  fileData: `${attachment.attachment.toString()}`,
                  id: channel.id
              }
          })

          let ticket = await db.get(`ticket_${channel.id}`)
          let ticketClaimedBy = await db.get(`claimed_${channel.id}`)
          if (ticketClaimedBy !== "no") {
              ticketClaimedBy = `<@${ticketClaimedBy}>`
          }
          if (!ticket) return;

          await db.delete(`ticket_${channel.id}`) 
        await db.delete(`hasaticket_${interaction.member.id}`)
          await db.push("closedTickets", channel.id)

          let owner = await interaction.guild.members.fetch(ticket.owner)

          let linkBtn = new ButtonBuilder()
          .setStyle(Discord.ButtonStyle.Link)
          .setURL(`https://ticketsarchive--tickbot.repl.co/ticket/${channel.id}`)
          .setLabel("النسخة الالكترونية من التذكرة")

          const r = new Discord.ActionRowBuilder()
          .addComponents([linkBtn])

          await owner.send({
              embeds: [new EmbedBuilder()
              .setColor(Discord.Colors.Aqua)
          .setDescription(`تم اغلاق تذكرتك في سيرفر : ${interaction.guild.name}
          من قبل : ${interaction.member}
          تم حفظ نسخة الكترونية من التذكرة الخاصة بك اضغط على الزر بالاسفل لرؤيتها`)],
          components: [r]
          })


          await channel.send({
              embeds: [new EmbedBuilder()
              .setTitle(`التذكرة مغلقة`)
          .setDescription(`تم اغلاق التذكرة بنجاح من قبل : ${interaction.member}`)
        .setColor(Discord.Colors.Red)],
          })
          await channel.send(`### من اجل مراجعة التذكرة تم حفظ نسخة الكترونية منها في قاعدة البيانات الخاصة بنا ويمكن رؤيتهعا من خلال هذا الرابط : https://ticketsarchive--tickbot.repl.co/ticket/${channel.id}`)
          await channel.send("جاري حذف التذكرة")
          setTimeout(async () => {
            let logChannel = await interaction.guild.channels.fetch(config.logID)
              await logChannel.send({
                  embeds: [new EmbedBuilder()
                  .setTitle("غلق تذكرة")
              .setDescription(`تم غلق تذكرة 
              معلومات التذكرة :

              صاحب التذكرة : ${owner}
              ايدي التذكرة : ${channel.id}
              مستلمة من قبل : ${ticketClaimedBy}
              اغلقت من قبل : ${interaction.member}`)
          .setColor(Discord.Colors.Red)],
          components: [r]
              })
              channel.delete()
          }, 5000)
            
      }
      if (interaction.options.getSubcommand() === "debug") {
        if (!interaction.member.roles.cache.has("1143835993389137950")) {
            return;
        }

       let ticket = await db.get(`ticket_${interaction.channel.id}`)

        if (ticket) {
          await interaction.reply({
            content: `هذه التذكرة مسجلة في قاعدة البيانات`,
            ephemeral: true
          })
        }

        if (!ticket || ticket === null) {
          let cancelBtn = new ButtonBuilder()
          .setLabel("الغاء الامر")
          .setStyle(Discord.ButtonStyle.Danger)
          .setCustomId("cancelDebug")

          let deleteChannelBtn = new ButtonBuilder()
          .setLabel("حذف التذكرة")
          .setStyle(Discord.ButtonStyle.Danger)
          .setCustomId("deleteBuggedChannel")
          
          let row = new Discord.ActionRowBuilder()
          .addComponents([cancelBtn, deleteChannelBtn])
          
          interaction.reply({
            embeds: [new EmbedBuilder()
                    .setTitle(`التذكرة غير موجودة`)
                    .setDescription(`هذه التذكرة غير موجودة في قاعدة البيانات اما انها ليست تذكرة او انه حدث خطأ ادى الى هذه المشكلة لذا يرجى اختيار ماذا تريد الفعل بهذه القناة`)
                    .setColor(Discord.Colors.Yellow)],
            components: [row]
            
          }).then(async msg => {
            interaction.channel.createMessageComponentCollector({
              time: 60000,
              max: 1,
              filter: (i) => i.user.id === interaction.user.id
            })
            .on("end", async (collected) => {
               await msg.delete() 
            })
            .on("collect", async i => {
                if (i.isButton()) {
                  if (i.customId === "deleteBuggedChannel") {
                    await i.channel.send(`جاري الحذف`)
                    setTimeout(async () => {
                      await interaction.channel.delete()
                    }, 4000)
                  }
                      
                }
            })
            
        })
          return;
        
      }
    }
  }
  }
})

client.on("interactionCreate", async interaction => {
    if (interaction.isButton()) {
        let logChannel = await interaction.guild.channels.fetch(config.logID)
        if (interaction.customId === "closeTicket") {
          if (!interaction.member.roles.cache.has("1143835993389137950")) return interaction.deferUpdate();

            let channel = interaction.channel 

            let closedTickets = await db.get("closedTickets")

            if (closedTickets) {
                let t = closedTickets.find(id => id === channel.id) 

            if (t) {
                return interaction.reply({
                    content: `هذه التذكرة مغلقة`,
                })
            }
            }

          interaction.channel.send({
            embeds: [new EmbedBuilder()
                .setDescription(`جاري اغلاق التذكرة هذا الاجراء قد يأخذ بعض الوقت`)
            .setColor(Discord.Colors.Yellow)]
          })


            await channel.edit({
                permissionOverwrites: [
                    {
                        id: interaction.member.id,
                        deny: ["SendMessages", "ViewChannel", "AttachFiles"]
                    },
                    {
                        id: client.user.id,
                        allow: ["SendMessages", "ViewChannel", "AttachFiles"]
                    },
                    {
                        id: interaction.guild.roles.everyone,
                        deny: ["ViewChannel"]
                    }
                ]
            })

            await interaction.deferUpdate()

            let transcripter = require("discord-html-transcripts")

            let attachment = await transcripter.createTranscript(channel)

            

            let ticket = await db.get(`ticket_${channel.id}`)
            let ticketClaimedBy = await db.get(`claimed_${channel.id}`)
            if (ticketClaimedBy !== "no") {
                ticketClaimedBy = `<@${ticketClaimedBy}>`
            }
          if (!ticket) {
            await interaction.channel.send({
            embeds: [new EmbedBuilder()
                    .setTitle("خطأ")
                    .setDescription(`هذه التذكرة ليست موجودة في قاعدة البيانات الخاصة بي قد تكون محذوفة او غير موجودة لذلك سيتم حذفها من دون حفظ بياناتها`)
                    .setColor(Discord.Colors.Red)]
          });
            let linkBtn1 = new ButtonBuilder()
            .setStyle(Discord.ButtonStyle.Link)
            .setURL(`https://ticketsarchive--tickbot.repl.co/ticket/${channel.id}`)
            .setLabel("النسخة الالكترونية من التذكرة")

            const r1 = new Discord.ActionRowBuilder()
            .addComponents([linkBtn1])



            await logChannel.send({
              embeds: [new EmbedBuilder()
              .setTitle("غلق تذكرة")
            .setDescription(`تم غلق تذكرة 
            معلومات التذكرة :

            صاحب التذكرة : لا يوجد بسبب حدوث خطأ يمكنك رؤيته من النسخة الالكترونية
            ايدي التذكرة : ${channel.id}
            مستلمة من قبل : ${ticketClaimedBy}
            اغلقت من قبل : ${interaction.member}`)
            .setColor(Discord.Colors.Red)],
            files: [attachment],
            })
            setTimeout(() => {
              interaction.channel.delete()
            }, 4000)
            return;
          }

            await db.delete(`ticket_${channel.id}`) 
          await db.delete(`hasaticket_${interaction.member.id}`)
            await db.push("closedTickets", channel.id)

            let owner = await interaction.guild.members.fetch(ticket.owner)

            let linkBtn = new ButtonBuilder()
            .setStyle(Discord.ButtonStyle.Link)
            .setURL(`https://ticketsarchive--tickbot.repl.co/ticket/${channel.id}`)
            .setLabel("النسخة الالكترونية من التذكرة")

            const r = new Discord.ActionRowBuilder()
            .addComponents([linkBtn])

            await owner.send({
                embeds: [new EmbedBuilder()
                .setColor(Discord.Colors.Aqua)
            .setDescription(`تم اغلاق تذكرتك في سيرفر : ${interaction.guild.name}
            من قبل : ${interaction.member}
            تم حفظ تذكرتك يمكنك رأيتها من خلال تنزيل الملف المرفق مع هذه الرسالة والضغط عليه`)],
              files: [attachment],
            })


            await channel.send({
                embeds: [new EmbedBuilder()
                .setTitle(`التذكرة مغلقة`)
            .setDescription(`تم اغلاق التذكرة بنجاح من قبل : ${interaction.member}`)
        .setColor(Discord.Colors.Red)],
            })
            await channel.send({
              content: `### من اجل مراجعة التذكرة تم حفظ نسخة الكترونية منها في قاعدة البيانات الخاصة بنا ويمكن رؤيتهعا من خلال هذا الملف`,
              files: [attachment]
            })
            await channel.send("جاري حذف التذكرة")
            setTimeout(async () => {
                await logChannel.send({
                    embeds: [new EmbedBuilder()
                    .setTitle("غلق تذكرة")
                .setDescription(`تم غلق تذكرة 
                معلومات التذكرة :

                صاحب التذكرة : ${owner}
                ايدي التذكرة : ${channel.id}
                مستلمة من قبل : ${ticketClaimedBy}
                اغلقت من قبل : ${interaction.member}`)
            .setColor(Discord.Colors.Red)],
            components: [r]
                })
                channel.delete()
            }, 5000)
        }
        if (interaction.customId === "claimTicket") {
            if (!interaction.member.roles.cache.has("1143835993389137950")) return interaction.deferUpdate();

            let ticket = await db.get(`ticket_${interaction.channel.id}`)
          if (!ticket) {
            return interaction.channel.send({
            embeds: [new EmbedBuilder()
                    .setTitle("خطأ")
                    .setDescription(`هذه التذكرة ليست موجودة في قاعدة البيانات الخاصة بي قد تكون محذوفة او غير موجودة لذلك يرجى حذفها يدويا `)
                    .setColor(Discord.Colors.Red)]
          });
          }
            let owner = await interaction.guild.members.fetch(ticket.owner)


            let claimed = await db.get(`claimed_${interaction.channel.id}`)

            if (!claimed) {
              return interaction.channel.send({
                embeds: [new EmbedBuilder()
                        .setTitle("خطأ")
                        .setDescription(`هذه التذكرة ليست موجودة في قاعدة البيانات الخاصة بي قد تكون محذوفة او غير موجودة لذلك يرجى حذفها يدويا `)
                        .setColor(Discord.Colors.Red)]
              });
            }

            if (claimed !== "no") {
                if (claimed === interaction.member.id) {
                    await db.set(`claimed_${interaction.channel.id}`, "no")
                    await interaction.channel.send({
                        embeds: [new EmbedBuilder()
                        .setTitle("ترك التذكرة")
                    .setDescription(`قام ${interaction.member} بترك تذكرتك`)
                .setColor(Discord.Colors.Red)]

                    })

                  await interaction.channel.permissionOverwrites.edit("1143835993389137950", {
                      SendMessages: true,
                      ViewChannel: true
                  })

                  
                  
                    await logChannel.send({
                        embeds: [new EmbedBuilder()
                            .setTitle("ترك تذكرة")
                        .setDescription(`تم ترك تذكرة 
                        معلومات التذكرة :

                        صاحب التذكرة : ${owner}
                        ايدي التذكرة : ${interaction.channel.id}
                        تم تركها من قبل : ${interaction.member}`)
                    .setColor(Discord.Colors.Red)]
                    })
                    await interaction.deferUpdate()
                    return;
                }
                if (claimed !== interaction.member.id) {
                    return interaction.reply({
                        content: `هذه التذكرة مستلمة من قبل شخص اخر ولا يمكنك استلامها`,
                        ephemeral: true
                    })
                    return;
                }
            }

            if (claimed === "no") {
                await db.set(`claimed_${interaction.channel.id}`, interaction.member.id)

                await interaction.channel.send({
                    embeds: [new EmbedBuilder()
                    .setTitle("استلام التذكرة")
                .setDescription(`قام ${interaction.member} باستلام تذكرتك`)
            .setColor(Discord.Colors.Red)]
                })
                await interaction.deferUpdate()

                await interaction.channel.permissionOverwrites.edit("1143835993389137950", {
                    SendMessages: false,
                    ViewChannel: false
                })

              await interaction.channel.permissionOverwrites.edit(interaction.member.id, {
                  SendMessages: true,
                  ViewChannel: true
              })

                await logChannel.send({
                    embeds: [new EmbedBuilder()
                        .setTitle("استلام تذكرة")
                    .setDescription(`تم استلام تذكرة 
                    معلومات التذكرة :

                    صاحب التذكرة : ${owner}
                    ايدي التذكرة : ${interaction.channel.id}
                    تم استلامها من قبل : ${interaction.member}`)
                .setColor(Discord.Colors.Red)]
                })

                return;
            }
        }
    }
})

client.on("interactionCreate", async (interaction) => {
  if (interaction.isStringSelectMenu()) {
     let logChannel = await interaction.guild.channels.fetch(config.logID)
    if (interaction.customId === "ticketsMenu") {

        let members = await db.get("ticketsMembers")

        if (members) {
            let m = members.find(id => id === interaction.member.id) 

        if (m) {
            return interaction.reply({
                content: `لديك تذكرة مفتوحة من قل البرجاء اغلاقها قبل محاولة فتح واحدة اخرى`,
                ephemeral: true
            })
        }
        }


        let reply = interaction.reply({
            content: "جاري فتح تذكرتك الرجاء الانتظار ...",
            ephemeral: true
        })

        let ticketKind = config.tickets.find(t => t.value === interaction.values[0])

        await interaction.guild.channels.create({
            type: Discord.ChannelType.GuildText,
            name: `ticket-${interaction.member.user.username}`,
            permissionOverwrites: [
                {
                    id: interaction.member.id,
                    allow: ["SendMessages", "ViewChannel", "AttachFiles"]
                },
                {
                    id: client.user.id,
                    allow: ["SendMessages", "ViewChannel", "AttachFiles"]
                },
             {
                  id: `1143835993389137950`,
                  allow: ["SendMessages", "ViewChannel", "AttachFiles"]
              },
                {
                    id: interaction.guild.roles.everyone,
                    deny: ["ViewChannel"]
                }
            ],
            parent: ticketKind.catID
        }).then(async channel => {
            let btn = new ButtonBuilder()
            .setLabel("اغلاق التذكرة")
            .setCustomId(`closeTicket`)
            .setStyle(Discord.ButtonStyle.Danger)

            let btn2 = new ButtonBuilder()
            .setLabel("استلام التذكرة")
            .setCustomId("claimTicket")
            .setStyle(Discord.ButtonStyle.Secondary)


            let row = new Discord.ActionRowBuilder()
            .addComponents([btn, btn2])


            await channel.send({
                content:`<@&1143835993389137950>`, embeds: [new EmbedBuilder()
                .setTitle(`تذكرة جديدة`)
                .setDescription(`تذكرة مساعدة جديدة خاصة بـ ${interaction.member}
                نوع التذكرة : ${ticketKind.name}`)],
                components: [row]
            })
            await db.set(`ticket_${channel.id}`, {
                id: channel.id,
                owner: interaction.member.id
            })

            await db.set(`hasaticket_${interaction.member.id}`, channel.id)

            await db.set(`claimed_${channel.id}`, "no");

            (await reply).edit(`تم تجهيز التذكرة الخاصة بك ${channel}`)
            await logChannel.send({
                embeds: [new EmbedBuilder()
                .setTitle("فتح تذكرة جديدة")
            .setDescription(`تم فتح تذكرة جديدة 
            معلومات التذكرة :

            صاحب التذكرة : ${interaction.member}
            ايدي التذكرة : ${channel.id}
            التذكرة : ${channel}
            نوع التذكرة : ${ticketKind.name}`)
        .setColor(Discord.Colors.Red)]
            })
        })
    }
  }
})


client.login(process.env.token)