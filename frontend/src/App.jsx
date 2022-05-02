import {Route, Routes} from "react-router-dom";
import Home from "./pages/Home";
import {useState} from "react";
import {ColorSchemeProvider, LoadingOverlay, MantineProvider} from "@mantine/core";
import Keycloak from "keycloak-js";
import {ReactKeycloakProvider} from '@react-keycloak/web'
import LinkPage from "./pages/Link";
import {NotificationsProvider} from "@mantine/notifications";

function App() {
    const keycloak = new Keycloak({
        "url": "https://auth.bte-germany.de",
        "realm": "btegermany",
        "clientId": "mapfrontend"
    });
    const [colorScheme, setColorScheme] = useState('dark');
    const toggleColorScheme = (value) =>
        setColorScheme(value || (colorScheme === 'dark' ? 'light' : 'dark'));
    return (
        <div>

            <ColorSchemeProvider colorScheme={colorScheme} toggleColorScheme={toggleColorScheme}>
                <MantineProvider theme={{colorScheme}} withGlobalStyles withNormalizeCSS>
                    <NotificationsProvider>
                        <ReactKeycloakProvider
                            authClient={keycloak}
                            LoadingComponent={<div style={{
                                display: "absolute",
                                top: "0",
                                left: "0",
                                zIndex: "9999",
                                maxHeight: "100vh",
                                maxWidth: "100vw"
                            }}>
                                <LoadingOverlay visible={true}/>
                            </div>}
                        >
                            <Routes>
                                <Route path="/" element={<Home/>} exact/>
                                <Route path="/link" element={<LinkPage/>} exact/>
                            </Routes>

                        </ReactKeycloakProvider>
                    </NotificationsProvider>
                </MantineProvider>
            </ColorSchemeProvider>

        </div>
    )
}

export default App
