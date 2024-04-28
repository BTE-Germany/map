/*+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 + StatCard.jsx                                                               +
 +                                                                            +
 + Copyright (c) 2022-2023 Robin Ferch                                        +
 + https://robinferch.me                                                      +
 + This project is released under the MIT license.                            +
 +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/

import React from 'react';
import {Group, Image, Paper, Text, TextInput, Title, Box} from "@mantine/core";
import classes from "./StatCard.module.css";


const StatCard = ({title, Icon, innerImage, value, subtitle, noBigValue, editable, id, additionalElement = null, showAdditionalElement = true, visible = true, skinny = false, onClickFunction = null}) => {
    if (!visible)
        return null;
    return (
        <Paper withBorder p={skinny ? 0 : "md"} radius="md" shadow="md" sx={{width: "100%"}} onClick={onClickFunction}>
            <Group position="apart" m={skinny ? "md" : 0} mb={0}>
                <Text size="xs" color="dimmed" className={classes.title}>
                    {title}
                </Text>
                <Icon className={classes.icon} size={22} />
            </Group>

            <Group align="flex-end" spacing="xs" mt={skinny ? 0 : 15} width="100%">
                {value != null ?
                    <Box sx={{display: "flex", alignItems: "center"}} style={{width: "100%"}}>
                        {innerImage ?
                            <Image src={innerImage} alt="" radius={"md"} style={{width: 64, marginRight: 10}} /> :
                            null
                        }
                        {editable ?
                            <TextInput id={id} defaultValue={value} style={{width: "100%"}} /> :
                            !noBigValue ?
                                <Title ml={"md"} order={3} className={classes.value}>{value}</Title> : value
                        }
                    </Box>
                    : null
                }
                {showAdditionalElement && additionalElement ?
                    <Box mr={skinny ? "md" : 0} style={{width: "100%"}}>
                        {additionalElement}
                    </Box> : null
                }
            </Group>

            <Text size="xs" color="dimmed" mt={7}>
                {subtitle}
            </Text>
        </Paper>
    );
};

export default StatCard;
