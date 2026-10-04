(function (root) {
    const jobs = [
        {
            name: "Astrologian",
            jobId: 33,
            fields: {"Card1":"string","Card2":"string","Card3":"string","Crown_Card":"string"},
            conditions: [],
            progress: [],
            maxima: [],
            tests: [null,null,null,null],
            types: ["Combo","Combo","Combo","Combo"]
        },
        {
            name: "Bard",
            jobId: 23,
            fields: {"Active_Song":"string","Last_Active_Song":"string","Song_Timer":"float","Repertoire_Stacks":"int","Max_Repertoire_Stacks":"int","Soul_Voice":"int"},
            conditions: ["Song_Timer","Repertoire_Stacks","Max_Repertoire_Stacks","Soul_Voice"],
            progress: ["Song_Timer","Repertoire_Stacks","Soul_Voice"],
            maxima: [45,"Max_Repertoire_Stacks",100],
            tests: [null,null,"Song_Timer","Repertoire_Stacks","Soul_Voice",null],
            types: ["Combo","Combo","Numeric","Numeric","Numeric","Combo"]
        },
        {
            name: "BlackMage",
            jobId: 25,
            fields: {"Enochian":"bool","Enochian_Timer":"float","Polyglot_Stacks":"int","Max_Polyglot_Stacks":"int","Element":"string","Element_Timer":"float","Umbral_Ice_Stacks":"int","Astral_Fire_Stacks":"int","Umbral_Hearts":"int","Paradox":"bool","Astral_Soul_Stacks":"int"},
            conditions: ["Enochian_Timer","Polyglot_Stacks","Max_Polyglot_Stacks","Element_Timer","Umbral_Ice_Stacks","Astral_Fire_Stacks","Umbral_Hearts","Astral_Soul_Stacks"],
            progress: ["Enochian_Timer","Polyglot_Stacks","Element_Timer","Umbral_Ice_Stacks","Astral_Fire_Stacks","Umbral_Hearts","Astral_Soul_Stacks"],
            maxima: [30,"Max_Polyglot_Stacks",15,3,3,3,6],
            tests: ["Enochian","Enochian_Timer","Polyglot_Stacks",null,"Element_Timer","Umbral_Ice_Stacks","Astral_Fire_Stacks","Umbral_Hearts","Paradox","Astral_Soul_Stacks"],
            types: ["Boolean","Numeric","Numeric","Combo","Numeric","Numeric","Numeric","Numeric","Boolean","Numeric"]
        },
        {
            name: "Dancer",
            jobId: 38,
            fields: {"Feather_Stacks":"int","Esprit":"int","Dancing":"bool","Completed_Steps":"int"},
            conditions: ["Feather_Stacks","Esprit","Completed_Steps"],
            progress: ["Feather_Stacks","Esprit","Completed_Steps"],
            maxima: [4,100,4],
            tests: ["Feather_Stacks","Esprit","Dancing",null,null,null,null,null,"Completed_Steps"],
            types: ["Numeric","Numeric","Boolean","Combo","Combo","Combo","Combo","Combo","Numeric"]
        },
        {
            name: "DarkKnight",
            jobId: 32,
            fields: {"Blood":"int","Darkside_Timer":"float","Shadow_Timer":"float","Dark_Arts":"bool"},
            conditions: ["Blood","Darkside_Timer","Shadow_Timer"],
            progress: ["Blood","Darkside_Timer","Shadow_Timer"],
            maxima: [100,60,20],
            tests: ["Blood","Darkside_Timer","Shadow_Timer","Dark_Arts"],
            types: ["Numeric","Numeric","Numeric","Boolean"]
        },
        {
            name: "Dragoon",
            jobId: 22,
            fields: {"Life_Of_The_Dragon":"bool","Life_Of_The_Dragon_Timer":"float","First_Broods_Gaze_Stacks":"int","Firstminds_Focus_Stacks":"int"},
            conditions: ["Life_Of_The_Dragon_Timer","First_Broods_Gaze_Stacks","Firstminds_Focus_Stacks"],
            progress: ["Life_Of_The_Dragon_Timer","First_Broods_Gaze_Stacks","Firstminds_Focus_Stacks"],
            maxima: [20,2,2],
            tests: ["Life_Of_The_Dragon","Life_Of_The_Dragon_Timer","First_Broods_Gaze_Stacks","Firstminds_Focus_Stacks"],
            types: ["Boolean","Numeric","Numeric","Numeric"]
        },
        {
            name: "Gunbreaker",
            jobId: 37,
            fields: {"Cartridges":"int"},
            conditions: ["Cartridges"],
            progress: ["Cartridges"],
            maxima: [3],
            tests: ["Cartridges"],
            types: ["Numeric"]
        },
        {
            name: "Machinist",
            jobId: 31,
            fields: {"Heat":"int","Overheat":"bool","Overheat_Timer":"float","Battery":"int","Summon":"bool","Summon_Timer":"float"},
            conditions: ["Heat","Overheat_Timer","Battery","Summon_Timer"],
            progress: ["Heat","Overheat_Timer","Battery","Summon_Timer"],
            maxima: [100,10,100,12],
            tests: ["Heat","Overheat","Overheat_Timer","Battery","Summon","Summon_Timer"],
            types: ["Numeric","Boolean","Numeric","Numeric","Boolean","Numeric"]
        },
        {
            name: "Monk",
            jobId: 20,
            fields: {"Chakra_Stacks":"int","Max_Chakra_Stacks":"int","Masters_Gauge_Opo_Count":"int","Masters_Gauge_Raptor_Count":"int","Masters_Gauge_Coeurl_Count":"int","Solar_Nadi":"bool","Lunar_Nadi":"bool","Blitz_Timer":"float","Opoopo_Stacks":"int","Raptor_Stacks":"int","Coeurl_Stacks":"int"},
            conditions: ["Chakra_Stacks","Max_Chakra_Stacks","Blitz_Timer","Opoopo_Stacks","Raptor_Stacks","Coeurl_Stacks","Masters_Gauge_Opo_Count","Masters_Gauge_Raptor_Count","Masters_Gauge_Coeurl_Count"],
            progress: ["Chakra_Stacks","Blitz_Timer","Opoopo_Stacks","Raptor_Stacks","Coeurl_Stacks","Masters_Gauge_Opo_Count","Masters_Gauge_Raptor_Count","Masters_Gauge_Coeurl_Count"],
            maxima: ["Max_Chakra_Stacks",20,1,1,2,3,3,3],
            tests: ["Chakra_Stacks","Masters_Gauge_Opo_Count","Masters_Gauge_Raptor_Count","Masters_Gauge_Coeurl_Count","Solar_Nadi","Lunar_Nadi","Blitz_Timer","Opoopo_Stacks","Raptor_Stacks","Coeurl_Stacks"],
            types: ["Numeric","Numeric","Numeric","Numeric","Boolean","Boolean","Numeric","Numeric","Numeric","Numeric"]
        },
        {
            name: "Ninja",
            jobId: 30,
            fields: {"Kazematoi":"int","Ninki":"int"},
            conditions: ["Kazematoi","Ninki"],
            progress: ["Kazematoi","Ninki"],
            maxima: [5,100],
            tests: ["Kazematoi","Ninki"],
            types: ["Numeric","Numeric"]
        },
        {
            name: "Paladin",
            jobId: 19,
            fields: {"Oath":"int"},
            conditions: ["Oath"],
            progress: ["Oath"],
            maxima: [100],
            tests: ["Oath"],
            types: ["Numeric"]
        },
        {
            name: "Pictomancer",
            jobId: 42,
            fields: {"Pallete":"int","Paint":"int","Creature_Motif_Drawn":"bool","Weapon_Motif_Drawn":"bool","Landscape_Motif_Drawn":"bool","Creature_Motif":"string","Creature_Canvas":"string","Creature_Portrait":"string"},
            conditions: ["Pallete","Paint"],
            progress: ["Pallete","Paint"],
            maxima: [100,5],
            tests: ["Pallete","Paint","Creature_Motif_Drawn","Weapon_Motif_Drawn","Landscape_Motif_Drawn",null,null,null],
            types: ["Numeric","Numeric","Boolean","Boolean","Boolean","Combo","Combo","Combo"]
        },
        {
            name: "Reaper",
            jobId: 39,
            fields: {"Soul":"int","Shroud":"int","Enshroud_Timer":"float","Lemure_Shroud_Stacks":"int","Void_Shroud_Stacks":"int"},
            conditions: ["Soul","Shroud","Enshroud_Timer","Lemure_Shroud_Stacks","Void_Shroud_Stacks"],
            progress: ["Soul","Shroud","Enshroud_Timer","Lemure_Shroud_Stacks","Void_Shroud_Stacks"],
            maxima: [100,100,30,5,5],
            tests: ["Soul","Shroud","Enshroud_Timer","Lemure_Shroud_Stacks","Void_Shroud_Stacks"],
            types: ["Numeric","Numeric","Numeric","Numeric","Numeric"]
        },
        {
            name: "RedMage",
            jobId: 35,
            fields: {"White_Mana":"int","Black_Mana":"int","Mana_Stacks":"int"},
            conditions: ["White_Mana","Black_Mana","Mana_Stacks"],
            progress: ["White_Mana","Black_Mana","Mana_Stacks"],
            maxima: [100,100,3],
            tests: ["White_Mana","Black_Mana","Mana_Stacks",null],
            types: ["Numeric","Numeric","Numeric","Combo"]
        },
        {
            name: "Sage",
            jobId: 40,
            fields: {"Eukrasia":"bool","Addersgall_Timer":"float","Addersgall_Stacks":"int","Addersting_Stacks":"int"},
            conditions: ["Addersgall_Timer","Addersgall_Stacks","Addersting_Stacks"],
            progress: ["Addersgall_Timer","Addersgall_Stacks","Addersting_Stacks"],
            maxima: [20,3,3],
            tests: ["Eukrasia","Addersgall_Timer","Addersgall_Stacks","Addersting_Stacks"],
            types: ["Boolean","Numeric","Numeric","Numeric"]
        },
        {
            name: "Samurai",
            jobId: 34,
            fields: {"Setsu":"bool","Getsu":"bool","Ka":"bool","Kenki":"int","Meditation_Stacks":"int"},
            conditions: ["Kenki","Meditation_Stacks"],
            progress: ["Kenki","Meditation_Stacks"],
            maxima: [100,5],
            tests: ["Setsu","Getsu","Ka","Kenki","Meditation_Stacks"],
            types: ["Boolean","Boolean","Boolean","Numeric","Numeric"]
        },
        {
            name: "Scholar",
            jobId: 28,
            fields: {"Aetherflow_Stacks":"int","Fairie":"int","Seraph_Timer":"float"},
            conditions: ["Aetherflow_Stacks","Fairie","Seraph_Timer"],
            progress: ["Aetherflow_Stacks","Fairie","Seraph_Timer"],
            maxima: [3,100,22],
            tests: ["Aetherflow_Stacks","Fairie","Seraph_Timer"],
            types: ["Numeric","Numeric","Numeric"]
        },
        {
            name: "Summoner",
            jobId: 27,
            fields: {"Aetherflow_Stacks":"int","Next_Summon":"string","Active_Summon":"string","Summon_Timer":"float","Active_Attunement":"string","Attunement_Timer":"float","Attunement_Stacks":"int","Max_Attunement_Stacks":"int"},
            conditions: ["Aetherflow_Stacks","Summon_Timer","Attunement_Timer","Attunement_Stacks","Max_Attunement_Stacks"],
            progress: ["Aetherflow_Stacks","Summon_Timer","Attunement_Timer","Attunement_Stacks"],
            maxima: [2,15,30,"Max_Attunement_Stacks"],
            tests: ["Aetherflow_Stacks",null,null,"Summon_Timer",null,null,null,null,"Attunement_Timer","Attunement_Stacks"],
            types: ["Numeric","Combo","Combo","Numeric","Boolean","Boolean","Boolean","Combo","Numeric","Numeric"]
        },
        {
            name: "Viper",
            jobId: 41,
            fields: {"Rattling_Coil_Stacks":"int","Max_Rattling_Coil_Stacks":"int","Serpent_Offering":"int","Anguine_Tribute_Stacks":"int","Max_Anguine_Tribute_Stacks":"int"},
            conditions: ["Rattling_Coil_Stacks","Max_Rattling_Coil_Stacks","Serpent_Offering","Anguine_Tribute_Stacks","Max_Anguine_Tribute_Stacks"],
            progress: ["Rattling_Coil_Stacks","Serpent_Offering","Anguine_Tribute_Stacks"],
            maxima: ["Max_Rattling_Coil_Stacks",100,"Max_Anguine_Tribute_Stacks"],
            tests: ["Rattling_Coil_Stacks","Serpent_Offering","Anguine_Tribute_Stacks"],
            types: ["Numeric","Numeric","Numeric"]
        },
        {
            name: "Warrior",
            jobId: 21,
            fields: {"Wrath":"int"},
            conditions: ["Wrath"],
            progress: ["Wrath"],
            maxima: [100],
            tests: ["Wrath"],
            types: ["Numeric"]
        },
        {
            name: "WhiteMage",
            jobId: 24,
            fields: {"Lily_Timer":"float","Lily_Stacks":"int","Blood_Lily_Stacks":"int"},
            conditions: ["Lily_Timer","Lily_Stacks","Blood_Lily_Stacks"],
            progress: ["Lily_Timer","Lily_Stacks","Blood_Lily_Stacks"],
            maxima: [20,3,3],
            tests: ["Lily_Timer","Lily_Stacks","Blood_Lily_Stacks"],
            types: ["Numeric","Numeric","Numeric"]
        }
    ]
    if (typeof module !== "undefined") module.exports = jobs
    else root.PreviewJobData = jobs
})(globalThis)
