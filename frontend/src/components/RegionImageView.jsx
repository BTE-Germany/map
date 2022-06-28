/*+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 + RegionImageView.jsx                                                        +
 +                                                                            +
 + Copyright (c) 2022 Robin Ferch                                             +
 + https://robinferch.me                                                      +
 + This project is released under the MIT license.                            +
 +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/

import React from 'react';
import {Box, Group, Text, useMantineTheme} from '@mantine/core';
import {TbUpload, TbPhoto, TbX} from 'react-icons/tb';
import {Dropzone, IMAGE_MIME_TYPE} from '@mantine/dropzone';
import {useKeycloak} from "@react-keycloak-fork/web";

function getIconColor(status, theme) {
    return status.accepted ? theme.colors[theme.primaryColor][theme.colorScheme === 'dark' ? 4 : 6] : status.rejected ? theme.colors.red[theme.colorScheme === 'dark' ? 4 : 6] : theme.colorScheme === 'dark' ? theme.colors.dark[0] : theme.colors.gray[7];
}

function ImageUploadIcon({
                             status, ...props
                         }) {
    if (status.accepted) {
        return <TbUpload {...props} />;
    }

    if (status.rejected) {
        return <TbX {...props} />;
    }

    return <TbPhoto {...props} />;
}

export const dropzoneChildren = (status, theme) => (
    <Group position="center" spacing="xl" style={{minHeight: 220, pointerEvents: 'none'}}>
        <ImageUploadIcon status={status} style={{color: getIconColor(status, theme)}} size={80}/>

        <Box sx={{textAlign: "center"}}>
            <Text size="xl" inline>
                Drag images here or click to select files
            </Text>
            <Text size="sm" color="dimmed" inline mt={7}>
                Attach as many files as you like, each file should not exceed 5mb
            </Text>
        </Box>
    </Group>
);


const RegionImageView = props => {
    const theme = useMantineTheme();
    const {keycloak} = useKeycloak();
    return (<div>
        <Dropzone
            onDrop={(files) => console.log('accepted files', files)}
            onReject={(files) => console.log('rejected files', files)}
            maxSize={3 * 1024 ** 2}
            accept={IMAGE_MIME_TYPE}
        >
            {(status) => dropzoneChildren(status, theme)}
        </Dropzone>
    </div>);
}

export default RegionImageView
