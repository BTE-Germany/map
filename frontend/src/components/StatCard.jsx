/*+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 + StatCard.jsx                                                               +
 +                                                                            +
 + Copyright (c) 2022 Robin Ferch                                             +
 + https://robinferch.me                                                      +
 + This project is released under the MIT license.                            +
 +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/

import React from 'react';
import { createStyles, Group, Input, Paper, Text, TextInput, Button, ActionIcon } from "@mantine/core";


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

const StatCard = ({ title, Icon, value, subtitle, noBigValue, editable, id }) => {
    const { classes } = useStyles();
    const internValue = value;
    if (editable) {
        return (
            <Paper withBorder p="md" radius="md" shadow="md" sx={{ width: "100%" }}>
                <Group position="apart">
                    <Text size="xs" color="dimmed" className={classes.title}>
                        Edit: {title}
                    </Text>
                    <Icon className={classes.icon} size={22} />
                </Group>

                <Group align="flex-end" spacing="xs" mt={15}>
                    {
                        <TextInput id={id} defaultValue={value} />
                    }
                </Group>

                <Text size="xs" color="dimmed" mt={7}>
                    {subtitle}
                </Text>
            </Paper>
        )
    }
    else {
        return (
            <Paper withBorder p="md" radius="md" shadow="md" sx={{ width: "100%" }}>
                <Group position="apart">
                    <Text size="xs" color="dimmed" className={classes.title}>
                        {title}
                    </Text>
                    <Icon className={classes.icon} size={22} />
                </Group>

                <Group align="flex-end" spacing="xs" mt={15}>
                    {
                        !noBigValue ? <Text className={classes.value}>{value}</Text> : <>{value}</>
                    }
                </Group>

                <Text size="xs" color="dimmed" mt={7}>
                    {subtitle}
                </Text>
            </Paper>
        );
    }
}

export default StatCard
