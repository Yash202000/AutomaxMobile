export function handleNotification(data: any, navigation: any) {
    switch (data.type) {
        case "INCIDENT":
            navigation.navigate("IncidentDetails", {
                id: data.incidentId,
            });
            break;

        default:
            navigation.navigate("Home");
    }
}