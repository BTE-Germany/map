/*+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 + RegionImageView.jsx                                                        +
 +                                                                            +
 + Copyright (c) 2022-2023 Robin Ferch                                        +
 + https://robinferch.me                                                      +
 + This project is released under the MIT license.                            +
 +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/

import React, {useState} from 'react';
import {Group, Progress, Stack, Text, useMantineTheme, Image, ActionIcon} from '@mantine/core';
import {TbPhoto, TbUpload, TbX} from 'react-icons/tb';
import {Dropzone, IMAGE_MIME_TYPE} from '@mantine/dropzone';
import {useKeycloak} from "@react-keycloak-fork/web";
import {showNotification} from "@mantine/notifications";
import axios from "axios";
import {Carousel} from "@mantine/carousel";
import {AiFillDelete} from "react-icons/ai";
import {openConfirmModal} from "@mantine/modals";


const ImageAddDropzone = ({regionId, getData}) => {
    const theme = useMantineTheme();

    const [uploading, setUploading] = useState(false);
    const [uploadingStatus, setUploadingStatus] = useState(0);

    const {keycloak} = useKeycloak();

    const onUploadProgress = (progressEvent) => {
        const {loaded, total} = progressEvent;
        let percent = Math.floor((loaded * 100) / total);
        if (percent < 100) {
            setUploadingStatus(percent)
            console.log(percent)
        }
    };

    const upload = async (images) => {
        let formData = new FormData();
        images.forEach((img) => {
            formData.append("image", img);
        })
        setUploading(true);
        try {
            await axios.put(`api/v1/region/${regionId}/image/upload`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data', "Authorization": "Bearer " + keycloak.token
                },
                onUploadProgress: (progressEvent) => onUploadProgress(progressEvent)
            })
            getData()
            showNotification({
                "title": "Finished", "message": "Upload successful.", "color": "green"
            })
            setUploading(false);
        } catch (e) {
            if (e.response.status === 400) {
                showNotification({
                    "title": "Error.", "message": e.response.data, "color": "red"
                });
            } else {
                showNotification({
                    "title": "Error.", "message": e.message, "color": "red"
                });
            }

            setUploading(false);

        }

    }

    return (<Dropzone
        onDrop={(files) => upload(files)}
        onReject={(files) => {
            showNotification({
                "title": "Error.", "message": files[0].errors[0].message, "color": "red"
            })
        }}
        maxSize={10 * 1024 ** 2}
        accept={IMAGE_MIME_TYPE}
        sx={{height: 300}}
    >
        <Group position="center" pb={"xl"} style={{height: 300, pointerEvents: 'none', textAlign: "center"}}>
            {uploading ? <>
                <Stack align={"center"}>
                    <Progress value={uploadingStatus} w={"120%"} animate/>
                    <Text>Uploading your images...</Text>
                </Stack>

            </> : <>
                <Dropzone.Accept>
                    <TbUpload
                        size={80}
                        color={theme.colors[theme.primaryColor][theme.colorScheme === 'dark' ? 4 : 6]}
                    />
                </Dropzone.Accept>
                <Dropzone.Reject>
                    <TbX
                        size={80}
                        color={theme.colors.red[theme.colorScheme === 'dark' ? 4 : 6]}
                    />
                </Dropzone.Reject>
                <Dropzone.Idle>
                    <TbPhoto size={80}/>
                </Dropzone.Idle>

                <div>
                    <Text size="xl" inline>
                        Drag images here or click to select files
                    </Text>
                    <Text size="sm" color="dimmed" inline mt={7}>
                        Attach as many files as you like, each file should not exceed 5mb
                    </Text>
                </div>
            </>}
        </Group>
    </Dropzone>);
};


const RegionImageView = ({regionId, getData, regionImages, isOwner}) => {
    const theme = useMantineTheme();
    const {keycloak} = useKeycloak();
    const isAdmin = keycloak?.tokenParsed?.realm_access.roles.includes("mapadmin");


    const [deleteLoading, setDeleteLoading] = useState(false);

    const deleteImage = (id) => {
        openConfirmModal({
            title: 'Please confirm your action',
            children: (
                <Text size="sm">
                    Do you really want to delete this picture? This action can not be reverted!
                </Text>
            ),
            labels: {confirm: 'Delete', cancel: 'Cancel'},
            confirmProps: {
                color: "red"
            },
            centered: true,
            onConfirm: async () => {
                setDeleteLoading(true);
                await axios.delete(`api/v1/region/${regionId}/image/${id}`, {headers: {authorization: "Bearer " + keycloak.token}})
                getData()
                showNotification({
                    "title": "Finished", "message": "Deleted image successful.", "color": "green"
                })
                setDeleteLoading(false);
            },
        });
    }

    if ((!isOwner && !isAdmin) && regionImages?.length === 0) {
        return <></>
    }

    if ((isOwner || isAdmin) && regionImages?.length === 0) {
        return (
            <div style={{marginBottom: 15}}>
                <ImageAddDropzone regionId={regionId} getData={getData}/>
            </div>
        )
    }


    return (<div style={{marginBottom: 15}}>
        <Carousel mx="auto" sx={{maxWidth: "100%", maxHeight: 300}} withIndicators loop>

            {
                regionImages.map((img) => {
                    return (
                        <Carousel.Slide>
                            {
                                (isOwner || isAdmin) &&
                                <ActionIcon sx={{position: "absolute", zIndex: 50}} m={"sm"} color={"red"}
                                            onClick={() => deleteImage(img.id)} loading={deleteLoading}>
                                    <AiFillDelete/>
                                </ActionIcon>
                            }

                            <Image src={img.imageData} height={300}></Image>
                        </Carousel.Slide>
                    )
                })
            }
            {
                ((isOwner || isAdmin) && regionImages?.length < 5) && <Carousel.Slide>
                    <ImageAddDropzone regionId={regionId} getData={getData} isOwner={isOwner}/>
                </Carousel.Slide>
            }


        </Carousel>

    </div>);
};

export default RegionImageView;
