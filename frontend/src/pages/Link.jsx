/*+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 + Link.jsx                                                                   +
 +                                                                            +
 + Copyright (c) 2022-2024 Robin Ferch                                        +
 + https://robinferch.me                                                      +
 + This project is released under the MIT license.                            +
 +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/

import React, {useState} from 'react';
import {Box, Button, Code, Container, Group, Kbd, Stepper, TextInput, Title} from "@mantine/core";
import {useForm} from "@mantine/form";
import {Navigate, useNavigate} from "react-router-dom";
import NavHeader from "../components/NavHeader";
import {showNotification} from "@mantine/notifications";
import axios from "axios";
import {useOidc} from "../oidc";

const Link = props => {
    const { isUserLoggedIn, login, logout, oidcTokens } = useOidc();

    if (!isUserLoggedIn)
        return <Navigate to={"/"}/>

    const [active, setActive] = useState(0);
    const [loading, setLoading] = useState(false);
    const nextStep = () => setActive((current) => (current < 3 ? current + 1 : current));
    const prevStep = () => setActive((current) => (current > 0 ? current - 1 : current));

    const navigate = useNavigate();

    const linkAccount = async ({code}) => {
        console.log(code)
        setLoading(true);
        try {
            const {
                data,
                status
            } = await axios.post(`/api/v1/user/link`, {code}, {
                headers: {
                    authorization: "Bearer " + oidcTokens.accessToken
                }
            });

            showNotification({
                title: 'Link successfully',
                message: 'This account was successfully linked to ' + data.username,
                color: "green"
            })
            navigate("/");

            setLoading(false);
        } catch (e) {
            setLoading(false);
            if (e.response.status === 404) {
                showNotification({
                    title: 'Invalid code',
                    message: 'The code you have entered could not be found',
                    color: "red"
                })
            } else {
                showNotification({
                    title: 'Error',
                    message: 'An unknown error occurred, please report this to our support.',
                    color: "red"
                })
            }
        }

    }

    const codeForm = useForm({
        initialValues: {
            code: '',
        },
        validate: {
            code: (value) => (value.length !== 6 ? 'The code has to be 6 numbers long' : null),
        },
    });


    return (
        <>
            <NavHeader/>
            <Container mt={"md"} size={"lg"}>
                <Title>Link your Minecraft Account</Title>

                <form onSubmit={codeForm.onSubmit((values) => linkAccount(values))}>
                    <Stepper active={active} onStepClick={setActive} breakpoint="sm" mt={"xl"}>
                        <Stepper.Step label="First step" description="Connect to the server" py={"md"}>
                            First connect to our server. To to that, open Minecraft and click on "Multiplayer". Then
                            click
                            on "Direct connect" and enter <Code>bte-germany.de</Code> in the IP field.
                        </Stepper.Step>
                        <Stepper.Step label="Second step" description="Get your link code" py={"md"}>
                            Now press <Kbd>T</Kbd> to open your chat. Here, enter <Code>/map link</Code> and press
                            enter.
                            You
                            should now see a 6-digit code.
                        </Stepper.Step>
                        <Stepper.Step label="Final step" description="Link your account" py={"md"}>
                            Enter the code you got here.

                            <TextInput
                                required
                                label="Code"
                                placeholder="123456"
                                mt={"md"}
                                disabled={loading}
                                {...codeForm.getInputProps('code')}
                            />


                        </Stepper.Step>
                    </Stepper>
                    <Group position="center" mt="xl">

                        {
                            active !== 0 &&
                            <Button variant="default" onClick={prevStep} disabled={loading}>Back</Button>
                        }
                        {
                            active === 2 ? <Button type="submit" loading={loading}>Link Account</Button> :
                                <Button onClick={nextStep}>Next step</Button>
                        }

                    </Group>
                </form>


            </Container>
        </>
    );
}

export default Link
