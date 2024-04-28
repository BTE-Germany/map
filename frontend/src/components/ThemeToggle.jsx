/*+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 + ThemeToggle.jsx                                                            +
 +                                                                            +
 + Copyright (c) 2022 Robin Ferch                                             +
 + https://robinferch.me                                                      +
 + This project is released under the MIT license.                            +
 +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/

import React from 'react';
import {Group, Switch, useMantineColorScheme, useMantineTheme} from "@mantine/core";
import {BiSun, BiMoon} from "react-icons/bi";

const ThemeToggle = props => {
    const {colorScheme, toggleColorScheme} = useMantineColorScheme();
    const theme = useMantineTheme();
    return (
        <Group position="center" my={30}>
            <Switch
                checked={colorScheme === 'dark'}
                onChange={() => toggleColorScheme()}
                size="md"
                onLabel={<BiSun color={theme.white} size={20} stroke={1.5} />}
                offLabel={<BiMoon color={theme.colors.gray[6]} size={20} stroke={1.5} />}
            />
        </Group>

    );
};

export default ThemeToggle;
