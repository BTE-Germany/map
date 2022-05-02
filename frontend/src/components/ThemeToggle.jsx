import React from 'react';
import {createStyles, Group, Switch, useMantineColorScheme} from "@mantine/core";
import {BiSun, BiMoon} from "react-icons/bi";

const useStyles = createStyles((theme) => ({
    root: {
        position: 'relative',
        '& *': {
            cursor: 'pointer',
        },
    },

    icon: {
        pointerEvents: 'none',
        position: 'absolute',
        zIndex: 1,
        top: 3,
    },

    iconLight: {
        left: 4,
        color: theme.white,
    },

    iconDark: {
        right: 4,
        color: theme.colors.gray[6],
    },
}));

const ThemeToggle = props => {
    const { colorScheme, toggleColorScheme } = useMantineColorScheme();
    const { classes, cx } = useStyles();

    return (
        <Group position="center" my={30}>
            <div className={classes.root}>
                <BiSun className={cx(classes.icon, classes.iconLight)} size={18} />
                <BiMoon className={cx(classes.icon, classes.iconDark)} size={18} />
                <Switch checked={colorScheme === 'dark'} onChange={() => toggleColorScheme()} size="md" />
            </div>
        </Group>
    );
}

export default ThemeToggle
