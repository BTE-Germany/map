/*+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 + ReportDialog.jsx                                                           +
 +                                                                            +
 + Copyright (c) 2022-2023 Robin Ferch                                        +
 + https://robinferch.me                                                      +
 + This project is released under the MIT license.                            +
 +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/

import React, {useState} from 'react';
import {useModals} from "@mantine/modals";
import {Button, Checkbox, Group, NativeSelect, Select, Textarea, TextInput} from "@mantine/core";
import {useForm} from "@mantine/form";
import axios from "axios";
import {showNotification} from "@mantine/notifications";
import {useKeycloak} from "@react-keycloak-fork/web";

const ReportDialog = ({regionId, keycloak}) => {

    const [loading, setLoading] = useState(false);

    const modals = useModals();
    const form = useForm({
        initialValues: {
            comment: '',
            reason: 'incorrectBuilder',
            disclaimer: false,
        },
        validate: {
            comment: (value) => value.length > 50 ? null : 'Please enter at least 50 characters',
        },

    });

    const submitReport = async (val) => {
        setLoading(true);
        await axios.post(`/api/v1/region/${regionId}/report`, {
            comment: val.comment,
            reason: val.reason
        }, {headers: {authorization: "Bearer " + keycloak.token}});
        modals.closeAll();
        showNotification({
            title: 'Success',
            message: 'Report submitted',
            color: "green"
        })
        setLoading(false);
    }
    return (
        <div>
            <form onSubmit={form.onSubmit((values) => submitReport(values))}>
                <NativeSelect
                    label="Report reason"
                    placeholder="Please pick a report reason"
                    data={[
                        {value: 'incorrectBuilder', label: 'This region was not built by the specified builder'},
                        {value: 'inappropriateImages', label: 'One of the images is inappropriate'},
                        {value: 'wrongDimensions', label: 'The region has wrong dimensions'},
                        {value: 'other', label: 'Another reason (please specify below)'},
                    ]}
                    {...form.getInputProps('reason')}
                />
                <Textarea
                    mt={5}
                    placeholder="Please concretize, why you want to report this region."
                    label="Your comment"
                    required
                    {...form.getInputProps('comment')}
                />

                <Checkbox
                    mt={8}
                    label="I understand, that the abuse of this feature will result in a permanent ban."
                    {...form.getInputProps('disclaimer')}
                    required
                />


                <Group position="right" mt="md">
                    <Button type="submit" loading={loading}>Submit</Button>
                </Group>
            </form>
        </div>
    );
}

export default ReportDialog
