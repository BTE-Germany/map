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


const ImageAddDropzone = () => {
    const theme = useMantineTheme();
    return (
        <Dropzone
            onDrop={(files) => console.log('accepted files', files)}
            onReject={(files) => console.log('rejected files', files)}
            maxSize={3 * 1024 ** 2}
            accept={IMAGE_MIME_TYPE}
        >
            <Group position="center" spacing="xl" style={{minHeight: 220, pointerEvents: 'none'}}>
                <Dropzone.Accept>
                    <TbUpload
                        size={50}
                        color={theme.colors[theme.primaryColor][theme.colorScheme === 'dark' ? 4 : 6]}
                    />
                </Dropzone.Accept>
                <Dropzone.Reject>
                    <TbX
                        size={50}
                        color={theme.colors.red[theme.colorScheme === 'dark' ? 4 : 6]}
                    />
                </Dropzone.Reject>
                <Dropzone.Idle>
                    <TbPhoto size={50}/>
                </Dropzone.Idle>

                <div>
                    <Text size="xl" inline>
                        Drag images here or click to select files
                    </Text>
                    <Text size="sm" color="dimmed" inline mt={7}>
                        Attach as many files as you like, each file should not exceed 5mb
                    </Text>
                </div>
            </Group>
        </Dropzone>
    )
}


const RegionImageView = props => {
    const theme = useMantineTheme();
    const {keycloak} = useKeycloak();
    return (<div>
        <ImageAddDropzone/>
    </div>);
}

export default RegionImageView
