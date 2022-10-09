/*+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 + StatCard.jsx                                                               +
 +                                                                            +
 + Copyright (c) 2022 Robin Ferch                                             +
 + https://robinferch.me                                                      +
 + This project is released under the MIT license.                            +
 +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/

import React from 'react';
import {createStyles, Group, Image, Paper, Text, TextInput, Title, Box} from "@mantine/core";


const useStyles = createStyles((theme) => ({
    root: {
        padding: theme.spacing.xl * 1.5,
    },

    value: {
        fontSize: 24,
        fontWeight: 700,
        lineHeight: 1,
    },


    icon: {
        color: theme.colorScheme === 'dark' ? theme.colors.dark[3] : theme.colors.gray[4],
    },

    title: {
        fontWeight: 700,
        textTransform: 'uppercase',
    },
}));

const StatCard = ({title, Icon, innerImage, value, subtitle, noBigValue, editable, id}) => {
    const {classes} = useStyles();

    return (
        <Paper withBorder p="md" radius="md" shadow="md" sx={{width: "100%"}}>
            <Group position="apart">
                <Text size="xs" color="dimmed" className={classes.title}>
                    {title}
                </Text>
                <Icon className={classes.icon} size={22} />
            </Group>

            <Group align="flex-end" spacing="xs" mt={15}>
                <Box sx={{display: "flex", alignItems: "center"}} style={{width: "100%"}}>
                    {innerImage ?
                        <Image src={innerImage} alt="" radius={"md"} style={{width: 64, marginRight: 10}} /> :
                        null
                    }
                    {editable ?
                        <TextInput id={id} defaultValue={value} style={{width: "100%"}} /> :
                        !noBigValue ? <Title ml={"md"} order={3} className={classes.value}>{value}</Title> : {value}
                    }
                </Box>
            </Group>

            <Text size="xs" color="dimmed" mt={7}>
                {subtitle}
            </Text>
        </Paper>
    );
};

export default StatCard;
